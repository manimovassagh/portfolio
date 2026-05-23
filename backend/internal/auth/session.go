package auth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/model"
)

const (
	CookieName      = "kapital_session"
	SessionDuration = 30 * 24 * time.Hour
)

var ErrNoSession = errors.New("no session")

type SessionStore interface {
	CreateUser(provider, providerSubject, email, name string) (model.User, error)
	CreateSession(userID string, expiresAt time.Time) (model.Session, error)
	GetSession(token string, now time.Time) (model.Session, model.User, error)
	DeleteSession(token string) error
}

func NewToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

func SetSessionCookie(c *gin.Context, token string, expiresAt time.Time, secure bool) {
	sameSite := http.SameSiteLaxMode
	if secure {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
	})
}

func ClearSessionCookie(c *gin.Context, secure bool) {
	sameSite := http.SameSiteLaxMode
	if secure {
		sameSite = http.SameSiteNoneMode
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
	})
}
