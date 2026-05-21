package service

import (
	"github.com/manimovassagh/portfolio/internal/model"
)

// BuildSummary aggregates enriched holdings into a portfolio-level summary.
func BuildSummary(holdings []model.Holding, txs []model.Transaction) model.PortfolioSummary {
	totalInvested := 0.0
	totalFees := 0.0
	totalTax := 0.0
	totalMV := 0.0
	totalPnL := 0.0

	for _, tx := range txs {
		if tx.Fee < 0 {
			totalFees += -tx.Fee
		}
		if tx.Tax < 0 {
			totalTax += -tx.Tax
		}
	}

	for _, h := range holdings {
		totalInvested += h.CostBasis
		if h.MarketValue != nil {
			totalMV += *h.MarketValue
		}
		if h.UnrealizedPnL != nil {
			totalPnL += *h.UnrealizedPnL
		}
	}

	s := model.PortfolioSummary{
		TotalInvested: totalInvested,
		TotalFees:     totalFees,
		TotalTax:      totalTax,
		Holdings:      holdings,
	}
	if totalMV > 0 {
		s.PortfolioValue = &totalMV
		s.TotalMarketValue = &totalMV
		s.TotalPnL = &totalPnL
		if totalInvested > 0 {
			pct := totalPnL / totalInvested * 100
			s.TotalPnLPct = &pct
		}
	}
	return s
}
