package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSAllowsKnownOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("CORS_ORIGINS", "http://localhost:5173")
	r := gin.New()
	r.Use(CORS())
	r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	r.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatalf("expected ACAO header, got %q", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORSBlocksUnknownOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("CORS_ORIGINS", "http://localhost:5173")
	r := gin.New()
	r.Use(CORS())
	r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://evil.example.com")
	r.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("expected no ACAO header for unknown origin, got %q", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORSPreflightReturns204(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("CORS_ORIGINS", "http://localhost:5173")
	r := gin.New()
	r.Use(CORS())
	r.OPTIONS("/test", func(c *gin.Context) {})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Code)
	}
}
