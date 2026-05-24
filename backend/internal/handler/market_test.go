package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestMarketQuoteFallsBackOnPricerNonOK(t *testing.T) {
	gin.SetMode(gin.TestMode)
	pricer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/quote":
			http.Error(w, `{"detail":"down"}`, http.StatusServiceUnavailable)
		case "/history":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"series":[{"date":"2024-01-01","close":120.0},{"date":"2024-01-02","close":123.0}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer pricer.Close()

	h := NewMarketHandler(config.Config{PricerURL: pricer.URL})
	r := gin.New()
	r.GET("/quote", h.Quote)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/quote?ticker=AAPL", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if got := w.Body.String(); !strings.Contains(got, `"ticker":"AAPL"`) || !strings.Contains(got, `"price":123`) {
		t.Fatalf("unexpected fallback body: %s", got)
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
