package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
)

func TestMarketQuoteRequiresTicker(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewMarketHandler(config.Config{PricerURL: "http://127.0.0.1:1"})
	r := gin.New()
	r.GET("/quote", h.Quote)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/quote", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestMarketProxyRejectsPricerNonOK(t *testing.T) {
	gin.SetMode(gin.TestMode)
	pricer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"detail":"down"}`, http.StatusServiceUnavailable)
	}))
	defer pricer.Close()

	h := NewMarketHandler(config.Config{PricerURL: pricer.URL})
	r := gin.New()
	r.GET("/quote", h.Quote)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/quote?ticker=AAPL", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}
}

func TestMarketProxyReturnsJSONPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)
	pricer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ticker":"AAPL","price":123.45}`))
	}))
	defer pricer.Close()

	h := NewMarketHandler(config.Config{PricerURL: pricer.URL})
	r := gin.New()
	r.GET("/quote", h.Quote)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/quote?ticker=AAPL", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if got := w.Body.String(); got != `{"price":123.45,"ticker":"AAPL"}` {
		t.Fatalf("unexpected body: %s", got)
	}
}
