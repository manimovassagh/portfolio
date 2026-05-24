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
	defer func() { _ = store.Close() }()

	h := NewWatchlistHandler(store, nil)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	r.POST("/watchlist", h.Add)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/watchlist", strings.NewReader(`{"name":"Apple"}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestWatchlistAllowsTickerFavorites(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()

	h := NewWatchlistHandler(store, nil)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	r.POST("/watchlist", h.Add)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/watchlist", strings.NewReader(`{"ticker":"AAPL","name":"Apple Inc."}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for ticker favorite, got %d: %s", w.Code, w.Body.String())
	}

	items, err := store.GetWatchlist("user-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ISIN != "AAPL" || items[0].Ticker != "AAPL" {
		t.Fatalf("unexpected item: %+v", items)
	}
}

func TestWatchlistNormalizesTickerAndISIN(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()

	h := NewWatchlistHandler(store, nil)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	r.POST("/watchlist", h.Add)

	// US0378331005 is Apple's real ISIN — lowercase input gets normalized to upper.
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/watchlist", strings.NewReader(`{"isin":" us0378331005 ","ticker":" aapl ","name":" Apple Inc. "}`))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	items, err := store.GetWatchlist("user-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ISIN != "US0378331005" || items[0].Ticker != "AAPL" || items[0].Name != "Apple Inc." {
		t.Fatalf("unexpected item: %+v", items)
	}
}
