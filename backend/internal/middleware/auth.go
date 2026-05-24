package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/auth"
	"github.com/manimovassagh/portfolio/internal/config"
)

func RequireAuth(cfg config.Config, store auth.SessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !cfg.AuthRequired {
			c.Next()
			return
		}

		token, err := c.Cookie(auth.CookieName)
		if err != nil || token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		_, user, err := store.GetSession(token, time.Now().UTC())
		if err != nil {
			auth.ClearSessionCookie(c, cfg.CookieSecure)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			return
		}

		c.Set("user_id", user.ID)
		c.Next()
	}
}

func RequireSession(cfg config.Config, store auth.SessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(auth.CookieName)
		if err != nil || token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "sign in required"})
			return
		}

		_, user, err := store.GetSession(token, time.Now().UTC())
		if err != nil {
			auth.ClearSessionCookie(c, cfg.CookieSecure)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "sign in required"})
			return
		}

		c.Set("user_id", user.ID)
		c.Next()
	}
}

func OptionalSession(cfg config.Config, store auth.SessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(auth.CookieName)
		if err != nil || token == "" {
			c.Next()
			return
		}

		_, user, err := store.GetSession(token, time.Now().UTC())
		if err != nil {
			auth.ClearSessionCookie(c, cfg.CookieSecure)
			c.Next()
			return
		}

		c.Set("user_id", user.ID)
		c.Next()
	}
}
