package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRateLimitBlocks(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/test", RateLimit(1, 2), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// First two requests (within burst) should pass
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = "1.2.3.4:9000"
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i+1, w.Code)
		}
	}

	// Third request (over burst) should be rejected
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "1.2.3.4:9000"
	r.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", w.Code)
	}
}
