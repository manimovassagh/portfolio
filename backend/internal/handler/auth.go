package handler

import (
	"database/sql"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/auth"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/model"
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
			"google":  os.Getenv("GOOGLE_CLIENT_ID") != "",
			"apple":   os.Getenv("APPLE_CLIENT_ID") != "",
			"passkey": true,
		},
	})
}

func (h *AuthHandler) Google(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Google OAuth is not configured yet"})
}

func (h *AuthHandler) Apple(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Apple Sign in is not configured yet"})
}

func (h *AuthHandler) PasskeyBegin(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "Passkey registration/login is not configured yet"})
}

func (h *AuthHandler) DevLogin(c *gin.Context) {
	if h.cfg.AuthRequired {
		c.JSON(http.StatusNotFound, gin.H{"error": "dev login is disabled when AUTH_REQUIRED=true"})
		return
	}
	user, err := h.store.CreateUser("dev", "local", "local@kapital.dev", "Local User")
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
