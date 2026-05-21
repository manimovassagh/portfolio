package pricer_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/manimovassagh/portfolio/internal/pricer"
)

func TestGetPrices(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/prices" {
			http.NotFound(w, r)
			return
		}
		json.NewEncoder(w).Encode(map[string]float64{
			"IE00BK5BQT80": 159.76,
			"BTC":          66000.0,
		})
	}))
	defer srv.Close()

	client := pricer.New(srv.URL)
	prices, err := client.GetPrices([]string{"IE00BK5BQT80", "BTC"})
	if err != nil {
		t.Fatalf("GetPrices error: %v", err)
	}
	if prices["IE00BK5BQT80"] != 159.76 {
		t.Errorf("expected 159.76, got %f", prices["IE00BK5BQT80"])
	}
	if prices["BTC"] != 66000.0 {
		t.Errorf("expected 66000, got %f", prices["BTC"])
	}
}

func TestGetPrices_EmptyList(t *testing.T) {
	client := pricer.New("http://localhost:19999")
	prices, err := client.GetPrices([]string{})
	if err != nil {
		t.Fatalf("empty list should not error, got: %v", err)
	}
	if len(prices) != 0 {
		t.Fatalf("expected empty map, got %v", prices)
	}
}

func TestGetPrices_PricerDown(t *testing.T) {
	client := pricer.New("http://localhost:19999")
	prices, err := client.GetPrices([]string{"TEST"})
	if err == nil {
		t.Fatal("expected error when pricer is down")
	}
	if prices != nil {
		t.Fatal("expected nil prices on error")
	}
}
