package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	rawOrigins := os.Getenv("CORS_ORIGINS")
	if rawOrigins == "" {
		rawOrigins = "http://localhost:5173,https://localhost:5173,http://localhost,http://localhost:8081"
	}
	allowed := map[string]bool{}
	for _, o := range strings.Split(rawOrigins, ",") {
		allowed[strings.TrimSpace(o)] = true
	}

	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if allowed[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.Header("Vary", "Origin")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
