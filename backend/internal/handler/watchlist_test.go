package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/db"
)

func TestWatchlistRejectsMissingISIN(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	h := NewWatchlistHandler(store)
	r := gin.New()
	r.POST("/watchlist", h.Add)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/watchlist", strings.NewReader(`{"name":"Apple"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestWatchlistNormalizesTickerAndISIN(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	h := NewWatchlistHandler(store)
	r := gin.New()
	r.POST("/watchlist", h.Add)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/watchlist", strings.NewReader(`{"isin":" aapl ","ticker":" aapl ","name":" Apple Inc. "}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	items, err := store.GetWatchlist()
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ISIN != "AAPL" || items[0].Ticker != "AAPL" || items[0].Name != "Apple Inc." {
		t.Fatalf("unexpected item: %+v", items)
	}
}
