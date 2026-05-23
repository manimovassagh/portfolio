package handler

import (
	"database/sql"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/auth"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/model"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	cfg   config.Config
	store auth.SessionStore
}

func NewAuthHandler(cfg config.Config, store auth.SessionStore) *AuthHandler {
	return &AuthHandler{cfg: cfg, store: store}
}

func (h *AuthHandler) Session(c *gin.Context) {
	token, err := c.Cookie(auth.CookieName)
	if err != nil || token == "" {
		c.JSON(http.StatusOK, model.AuthSession{Authenticated: false, Required: h.cfg.AuthRequired})
		return
	}

	_, user, err := h.store.GetSession(token, time.Now().UTC())
	if err != nil {
		auth.ClearSessionCookie(c, h.cfg.CookieSecure)
		c.JSON(http.StatusOK, model.AuthSession{Authenticated: false, Required: h.cfg.AuthRequired})
		return
	}

	c.JSON(http.StatusOK, model.AuthSession{Authenticated: true, Required: h.cfg.AuthRequired, User: &user})
}

func (h *AuthHandler) Providers(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"providers": gin.H{
			"local":   true,
			"google":  os.Getenv("GOOGLE_CLIENT_ID") != "",
			"apple":   os.Getenv("APPLE_CLIENT_ID") != "",
			"passkey": false,
		},
	})
}

func (h *AuthHandler) Google(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Google OAuth is not configured yet"})
}

func (h *AuthHandler) Apple(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Apple Sign in is not configured yet"})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid registration payload"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	password := strings.TrimSpace(req.Password)
	name := strings.TrimSpace(req.Name)
	if email == "" || !strings.Contains(email, "@") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "enter a valid email address"})
		return
	}
	if len(password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "password must be at least 8 characters"})
		return
	}
	if name == "" {
		name = strings.TrimSpace(strings.Split(email, "@")[0])
	}
	if name == "" {
		name = "Local User"
	}
	if _, _, err := h.store.GetLocalUserByEmail(email); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "an account with that email already exists"})
		return
	} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not check account"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not secure password"})
		return
	}
	user, err := h.store.CreateLocalUser(email, name, string(hash))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account"})
		return
	}
	h.issueSession(c, user)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid login payload"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	password := strings.TrimSpace(req.Password)
	if email == "" || password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "enter email and password"})
		return
	}
	user, hash, err := h.store.GetLocalUserByEmail(email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load account"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	h.issueSession(c, user)
}

func (h *AuthHandler) DevLogin(c *gin.Context) {
	if h.cfg.AuthRequired {
		c.JSON(http.StatusNotFound, gin.H{"error": "dev login is disabled when AUTH_REQUIRED=true"})
		return
	}
	var req struct {
		Username string `json:"username"`
	}
	username := strings.TrimSpace(c.GetHeader("X-Username"))
	if username == "" {
		username = strings.TrimSpace(c.Query("username"))
	}
	if username == "" {
		if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid dev login payload"})
			return
		}
		username = strings.TrimSpace(req.Username)
	}
	displayName := username
	if displayName == "" {
		displayName = "Local User"
	}
	subject := strings.ToLower(username)
	if subject == "" {
		subject = "local"
	}
	subject = strings.NewReplacer(":", "_", "/", "_", "\\", "_", " ", "_").Replace(subject)

	user, err := h.store.CreateUser("dev", subject, "local@kapital.dev", displayName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create dev user"})
		return
	}
	expiresAt := time.Now().UTC().Add(auth.SessionDuration)
	session, err := h.store.CreateSession(user.ID, expiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
		return
	}
	auth.SetSessionCookie(c, session.Token, session.ExpiresAt, h.cfg.CookieSecure)
	c.JSON(http.StatusOK, model.AuthSession{Authenticated: true, Required: false, User: &user})
}

func (h *AuthHandler) issueSession(c *gin.Context, user model.User) {
	expiresAt := time.Now().UTC().Add(auth.SessionDuration)
	session, err := h.store.CreateSession(user.ID, expiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create session"})
		return
	}
	auth.SetSessionCookie(c, session.Token, session.ExpiresAt, h.cfg.CookieSecure)
	c.JSON(http.StatusOK, model.AuthSession{Authenticated: true, Required: h.cfg.AuthRequired, User: &user})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	if token, err := c.Cookie(auth.CookieName); err == nil && token != "" {
		if err := h.store.DeleteSession(token); err != nil && err != sql.ErrNoRows {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not clear session"})
			return
		}
	}
	auth.ClearSessionCookie(c, h.cfg.CookieSecure)
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
