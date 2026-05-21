package handler

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/manimovassagh/portfolio/internal/auth"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/db"
	"github.com/manimovassagh/portfolio/internal/model"
)

// PasskeyHandler implements WebAuthn registration and login.
type PasskeyHandler struct {
	cfg      config.Config
	store    *db.Store
	sessions auth.SessionStore
	wn       *webauthn.WebAuthn
	mu       sync.Mutex
	pending  map[string]*webauthn.SessionData
}

func NewPasskeyHandler(cfg config.Config, store *db.Store, sessions auth.SessionStore) (*PasskeyHandler, error) {
	wn, err := webauthn.New(&webauthn.Config{
		RPDisplayName: "Kapital",
		RPID:          cfg.PasskeyRPID,
		RPOrigins:     []string{cfg.PasskeyOrigin},
	})
	if err != nil {
		return nil, fmt.Errorf("webauthn config: %w", err)
	}
	return &PasskeyHandler{
		cfg:      cfg,
		store:    store,
		sessions: sessions,
		wn:       wn,
		pending:  make(map[string]*webauthn.SessionData),
	}, nil
}

// passkeyUser wraps model.User to implement webauthn.User.
type passkeyUser struct {
	user  model.User
	creds []webauthn.Credential
}

func (u *passkeyUser) WebAuthnID() []byte                        { return []byte(u.user.ID) }
func (u *passkeyUser) WebAuthnName() string                      { return u.user.ProviderSubject }
func (u *passkeyUser) WebAuthnDisplayName() string               { return u.user.Name }
func (u *passkeyUser) WebAuthnCredentials() []webauthn.Credential { return u.creds }

// RegisterBegin starts passkey registration for a new or existing user.
func (h *PasskeyHandler) RegisterBegin(c *gin.Context) {
	var body struct {
		Username string `json:"username"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "username is required"})
		return
	}

	user, err := h.store.CreateUser("passkey", body.Username, "", body.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	creds, err := h.loadCredentials(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	wu := &passkeyUser{user: user, creds: creds}
	options, sessionData, err := h.wn.BeginRegistration(wu,
		webauthn.WithResidentKeyRequirement(protocol.ResidentKeyRequirementRequired),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	sid := genChallengeID()
	h.storePending(sid, sessionData)
	c.JSON(http.StatusOK, gin.H{"session_id": sid, "options": options})
}

// RegisterFinish completes passkey registration and issues a session cookie.
// Expects multipart body: session_id + username as JSON header, raw WebAuthn attestation as body.
func (h *PasskeyHandler) RegisterFinish(c *gin.Context) {
	sid := c.GetHeader("X-Session-Id")
	username := c.GetHeader("X-Username")
	if sid == "" || username == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Session-Id and X-Username headers are required"})
		return
	}

	sessionData := h.takePending(sid)
	if sessionData == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session expired or not found"})
		return
	}

	user, err := h.store.CreateUser("passkey", username, "", username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	creds, err := h.loadCredentials(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	wu := &passkeyUser{user: user, creds: creds}

	parsedCred, err := protocol.ParseCredentialCreationResponseBody(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad credential: " + err.Error()})
		return
	}

	credential, err := h.wn.CreateCredential(wu, *sessionData, parsedCred)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "credential verification failed: " + err.Error()})
		return
	}

	credID := base64.RawURLEncoding.EncodeToString(credential.ID)
	aaguid := base64.RawURLEncoding.EncodeToString(credential.Authenticator.AAGUID)
	if err := h.store.SavePasskeyCredential(user.ID, credID, credential.PublicKey, credential.Authenticator.SignCount, aaguid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.issueSession(c, user)
}

// LoginBegin starts a discoverable passkey login (no username required).
func (h *PasskeyHandler) LoginBegin(c *gin.Context) {
	options, sessionData, err := h.wn.BeginDiscoverableLogin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	sid := genChallengeID()
	h.storePending(sid, sessionData)
	c.JSON(http.StatusOK, gin.H{"session_id": sid, "options": options})
}

// LoginFinish completes passkey login.
// Expects X-Session-Id header + raw WebAuthn assertion as body.
func (h *PasskeyHandler) LoginFinish(c *gin.Context) {
	sid := c.GetHeader("X-Session-Id")
	if sid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "X-Session-Id header is required"})
		return
	}

	sessionData := h.takePending(sid)
	if sessionData == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session expired or not found"})
		return
	}

	parsedAssertion, err := protocol.ParseCredentialRequestResponseBody(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad assertion: " + err.Error()})
		return
	}

	var foundUser model.User
	_, err = h.wn.ValidateDiscoverableLogin(
		func(rawID, _ []byte) (webauthn.User, error) {
			credID := base64.RawURLEncoding.EncodeToString(rawID)
			user, cred, dbErr := h.store.GetUserByPasskeyCredID(credID)
			if dbErr != nil {
				return nil, dbErr
			}
			foundUser = user
			waCred, convErr := h.credRowToWebAuthn(cred)
			if convErr != nil {
				return nil, convErr
			}
			return &passkeyUser{user: user, creds: []webauthn.Credential{waCred}}, nil
		},
		*sessionData, parsedAssertion,
	)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "passkey verification failed"})
		return
	}

	h.issueSession(c, foundUser)
}

func (h *PasskeyHandler) issueSession(c *gin.Context, user model.User) {
	expiresAt := time.Now().UTC().Add(auth.SessionDuration)
	session, err := h.sessions.CreateSession(user.ID, expiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
		return
	}
	auth.SetSessionCookie(c, session.Token, session.ExpiresAt, h.cfg.CookieSecure)
	c.JSON(http.StatusOK, model.AuthSession{Authenticated: true, Required: h.cfg.AuthRequired, User: &user})
}

func (h *PasskeyHandler) loadCredentials(userID string) ([]webauthn.Credential, error) {
	rows, err := h.store.GetPasskeyCredentials(userID)
	if err != nil {
		return nil, err
	}
	out := make([]webauthn.Credential, 0, len(rows))
	for _, row := range rows {
		cred, err := h.credRowToWebAuthn(row)
		if err != nil {
			continue
		}
		out = append(out, cred)
	}
	return out, nil
}

func (h *PasskeyHandler) credRowToWebAuthn(row db.PasskeyCredRow) (webauthn.Credential, error) {
	rawID, err := base64.RawURLEncoding.DecodeString(row.ID)
	if err != nil {
		return webauthn.Credential{}, err
	}
	aaguid, _ := base64.RawURLEncoding.DecodeString(row.AAGUID)
	return webauthn.Credential{
		ID:        rawID,
		PublicKey: row.PublicKey,
		Authenticator: webauthn.Authenticator{
			AAGUID:    aaguid,
			SignCount: row.SignCount,
		},
	}, nil
}

func (h *PasskeyHandler) storePending(id string, data *webauthn.SessionData) {
	h.mu.Lock()
	h.pending[id] = data
	h.mu.Unlock()
	time.AfterFunc(5*time.Minute, func() {
		h.mu.Lock()
		delete(h.pending, id)
		h.mu.Unlock()
	})
}

func (h *PasskeyHandler) takePending(id string) *webauthn.SessionData {
	h.mu.Lock()
	defer h.mu.Unlock()
	data := h.pending[id]
	delete(h.pending, id)
	return data
}

func genChallengeID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("c%d", time.Now().UnixNano())
	}
	return base64.RawURLEncoding.EncodeToString(b[:])
}
