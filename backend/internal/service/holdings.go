package service

import (
	"math"
	"sort"
	"strings"

	"github.com/manimovassagh/portfolio/internal/model"
)

var buyTypes = map[string]bool{
	"BUY": true, "SAVINGS_PLAN": true, "ROUND_UP": true, "STOCK_PERK": true,
}
var sellTypes = map[string]bool{
	"SELL": true,
}

// ComputeHoldings walks transactions and returns current positions using average-cost method.
func ComputeHoldings(txs []model.Transaction) map[string]model.Holding {
	holdings, _ := ComputeHoldingsAndRealized(txs)
	return holdings
}

// ComputeHoldingsAndRealized returns both current positions and realized trades.
func ComputeHoldingsAndRealized(txs []model.Transaction) (map[string]model.Holding, []model.RealizedEntry) {
	holdings := map[string]model.Holding{}
	var realized []model.RealizedEntry

	for _, tx := range txs {
		if strings.ToUpper(tx.Category) != "TRADING" {
			continue
		}
		typ := strings.ToUpper(tx.Type)
		isin := tx.ISIN
		if isin == "" {
			continue
		}

		h := holdings[isin]
		h.ISIN = isin
		h.Name = tx.Name
		h.AssetClass = tx.AssetClass

		shares := math.Abs(tx.Shares)
		fee := math.Abs(tx.Fee)
		h.FeesPaid += fee

		if buyTypes[typ] {
			// Capitalize acquisition fees into cost basis (GAAP/IFRS treatment).
			// avg_cost = (amount + fee) / shares so P&L reflects total acquisition cost.
			h.CostBasis += math.Abs(tx.Amount) + fee
			h.Shares += shares
		} else if sellTypes[typ] {
			avgCost := 0.0
			if h.Shares > 1e-9 {
				avgCost = h.CostBasis / h.Shares
				h.CostBasis -= avgCost * shares
				if h.CostBasis < 0 {
					h.CostBasis = 0
				}
			}
			h.Shares -= shares
			if h.Shares < 1e-9 {
				h.Shares = 0
				h.CostBasis = 0
			}

			pnl := (tx.Price - avgCost) * shares
			pnlPct := 0.0
			if avgCost > 0 {
				pnlPct = (tx.Price - avgCost) / avgCost * 100
			}
			var date *string
			if tx.Date != "" {
				d := tx.Date
				date = &d
			}
			realized = append(realized, model.RealizedEntry{
				Date:      date,
				Name:      tx.Name,
				ISIN:      isin,
				Shares:    shares,
				SellPrice: tx.Price,
				AvgCost:   avgCost,
				PnL:       pnl,
				PnLPct:    pnlPct,
			})
		}

		if h.Shares > 1e-9 {
			h.AvgCost = h.CostBasis / h.Shares
		}
		holdings[isin] = h
	}

	for k, h := range holdings {
		if h.Shares < 1e-9 {
			delete(holdings, k)
		}
	}
	return holdings, realized
}

// EnrichWithPrices attaches live prices, market values, P&L and weights.
func EnrichWithPrices(holdings map[string]model.Holding, prices map[string]float64) []model.Holding {
	totalMV := 0.0
	for isin, h := range holdings {
		if p, ok := prices[isin]; ok {
			totalMV += p * h.Shares
		}
	}

	result := make([]model.Holding, 0, len(holdings))
	for _, h := range holdings {
		if p, ok := prices[h.ISIN]; ok {
			price := p
			mv := p * h.Shares
			pnl := mv - h.CostBasis
			pnlPct := 0.0
			if h.CostBasis > 0 {
				pnlPct = pnl / h.CostBasis * 100
			}
			h.CurrentPrice = &price
			h.MarketValue = &mv
			h.UnrealizedPnL = &pnl
			h.UnrealizedPct = &pnlPct
			if totalMV > 0 {
				h.Weight = mv / totalMV * 100
			}
		}
		result = append(result, h)
	}

	sort.Slice(result, func(i, j int) bool {
		mvi, mvj := 0.0, 0.0
		if result[i].MarketValue != nil {
			mvi = *result[i].MarketValue
		}
		if result[j].MarketValue != nil {
			mvj = *result[j].MarketValue
		}
		return mvi > mvj
	})
	return result
}
