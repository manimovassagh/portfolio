package service_test

import (
	"math"
	"testing"

	"github.com/manimovassagh/portfolio/internal/model"
	"github.com/manimovassagh/portfolio/internal/service"
)

func TestComputeHoldings_BuyOnly(t *testing.T) {
	txs := []model.Transaction{
		{Category: "TRADING", Type: "BUY", ISIN: "TEST01", Name: "Test ETF",
			AssetClass: "FUND", Shares: 2.0, Price: 100.0, Amount: -200.0, Fee: -1.0},
	}
	holdings := service.ComputeHoldings(txs)
	h, ok := holdings["TEST01"]
	if !ok {
		t.Fatal("expected holding TEST01")
	}
	if h.Shares != 2.0 {
		t.Errorf("expected shares 2.0, got %f", h.Shares)
	}
	// Fee is capitalized into cost basis: 200 (amount) + 1 (fee) = 201
	if h.CostBasis != 201.0 {
		t.Errorf("expected cost_basis 201.0 (amount + capitalized fee), got %f", h.CostBasis)
	}
	if h.AvgCost != 100.5 {
		t.Errorf("expected avg_cost 100.5, got %f", h.AvgCost)
	}
	if h.FeesPaid != 1.0 {
		t.Errorf("expected fees_paid 1.0, got %f", h.FeesPaid)
	}
}

func TestComputeHoldings_FeeCapitalizedIntoCostBasis(t *testing.T) {
	// BUY 10 shares @ €50 with €2 fee → cost basis = 502, avg_cost = 50.20
	txs := []model.Transaction{
		{Category: "TRADING", Type: "BUY", ISIN: "ETF01", Name: "ETF",
			AssetClass: "FUND", Shares: 10.0, Price: 50.0, Amount: -500.0, Fee: -2.0},
	}
	holdings := service.ComputeHoldings(txs)
	h := holdings["ETF01"]
	if h.CostBasis != 502.0 {
		t.Errorf("expected cost_basis 502.0, got %f", h.CostBasis)
	}
	if math.Abs(h.AvgCost-50.2) > 1e-9 {
		t.Errorf("expected avg_cost 50.20, got %f", h.AvgCost)
	}
}

func TestComputeHoldings_FeeCapitalized_RealizePnL(t *testing.T) {
	// BUY 2 shares @ €100 + €1 fee → avg_cost 100.5
	// SELL 2 shares @ €110 → P&L = (110 - 100.5) × 2 = 19.0
	txs := []model.Transaction{
		{Category: "TRADING", Type: "BUY", ISIN: "ETF01", Name: "ETF",
			AssetClass: "FUND", Shares: 2.0, Price: 100.0, Amount: -200.0, Fee: -1.0},
		{Category: "TRADING", Type: "SELL", ISIN: "ETF01", Name: "ETF",
			AssetClass: "FUND", Shares: -2.0, Price: 110.0, Amount: 220.0},
	}
	_, realized := service.ComputeHoldingsAndRealized(txs)
	if len(realized) != 1 {
		t.Fatalf("expected 1 realized entry, got %d", len(realized))
	}
	r := realized[0]
	if math.Abs(r.AvgCost-100.5) > 1e-9 {
		t.Errorf("expected avg_cost 100.5 (fee capitalized), got %f", r.AvgCost)
	}
	if math.Abs(r.PnL-19.0) > 1e-9 {
		t.Errorf("expected realized P&L 19.0, got %f", r.PnL)
	}
}

func TestComputeHoldings_BuySell(t *testing.T) {
	// BUY 4 shares @ €100, no fee → cost basis 400, avg_cost 100
	// SELL 2 shares → remaining cost basis = 400 - (100 × 2) = 200
	txs := []model.Transaction{
		{Category: "TRADING", Type: "BUY", ISIN: "TEST01", Name: "Test ETF",
			AssetClass: "FUND", Shares: 4.0, Price: 100.0, Amount: -400.0},
		{Category: "TRADING", Type: "SELL", ISIN: "TEST01", Name: "Test ETF",
			AssetClass: "FUND", Shares: -2.0, Price: 120.0, Amount: 240.0},
	}
	holdings := service.ComputeHoldings(txs)
	h := holdings["TEST01"]
	if h.Shares != 2.0 {
		t.Errorf("expected 2 shares remaining, got %f", h.Shares)
	}
	if h.CostBasis != 200.0 {
		t.Errorf("expected cost_basis 200 after partial sell, got %f", h.CostBasis)
	}
}

func TestComputeHoldings_FullSellRemoved(t *testing.T) {
	txs := []model.Transaction{
		{Category: "TRADING", Type: "BUY", ISIN: "TEST01", Name: "Test ETF",
			AssetClass: "FUND", Shares: 2.0, Amount: -200.0},
		{Category: "TRADING", Type: "SELL", ISIN: "TEST01", Name: "Test ETF",
			AssetClass: "FUND", Shares: -2.0, Amount: 220.0},
	}
	holdings := service.ComputeHoldings(txs)
	if _, ok := holdings["TEST01"]; ok {
		t.Fatal("fully sold position should be removed from holdings")
	}
}

func TestComputeHoldings_SkipsNonTrading(t *testing.T) {
	txs := []model.Transaction{
		{Category: "CASH", Type: "TRANSFER_INBOUND", Amount: 1000.0},
		{Category: "TRADING", Type: "BUY", ISIN: "TEST01", Name: "Test ETF",
			AssetClass: "FUND", Shares: 1.0, Amount: -100.0},
	}
	holdings := service.ComputeHoldings(txs)
	if len(holdings) != 1 {
		t.Errorf("expected 1 holding, got %d", len(holdings))
	}
}

func TestEnrichWithPrices(t *testing.T) {
	holdings := map[string]model.Holding{
		"TEST01": {ISIN: "TEST01", Shares: 2.0, CostBasis: 200.0, AvgCost: 100.0},
	}
	prices := map[string]float64{"TEST01": 120.0}
	enriched := service.EnrichWithPrices(holdings, prices)

	if len(enriched) != 1 {
		t.Fatalf("expected 1 enriched holding, got %d", len(enriched))
	}
	h := enriched[0]
	if h.CurrentPrice == nil || *h.CurrentPrice != 120.0 {
		t.Errorf("expected current_price 120.0")
	}
	if h.MarketValue == nil || *h.MarketValue != 240.0 {
		t.Errorf("expected market_value 240.0, got %v", h.MarketValue)
	}
	if h.UnrealizedPnL == nil || *h.UnrealizedPnL != 40.0 {
		t.Errorf("expected unrealized_pnl 40.0, got %v", h.UnrealizedPnL)
	}
	if h.Weight != 100.0 {
		t.Errorf("expected weight 100.0 (only holding), got %f", h.Weight)
	}
}

func TestEnrichWithPrices_MissingPrice(t *testing.T) {
	holdings := map[string]model.Holding{
		"TEST01": {ISIN: "TEST01", Shares: 2.0, CostBasis: 200.0},
		"TEST02": {ISIN: "TEST02", Shares: 1.0, CostBasis: 100.0},
	}
	prices := map[string]float64{"TEST01": 120.0}
	enriched := service.EnrichWithPrices(holdings, prices)

	if len(enriched) != 2 {
		t.Fatalf("expected 2 holdings, got %d", len(enriched))
	}
	for _, h := range enriched {
		if h.ISIN == "TEST02" {
			if h.CurrentPrice != nil {
				t.Error("TEST02 should have nil current_price")
			}
			if h.MarketValue != nil {
				t.Error("TEST02 should have nil market_value")
			}
		}
	}
}
