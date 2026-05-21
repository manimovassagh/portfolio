package handler

import (
	"math"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
	"github.com/manimovassagh/portfolio/internal/model"
	"github.com/manimovassagh/portfolio/internal/pricer"
	"github.com/manimovassagh/portfolio/internal/service"
)

type AnalyticsHandler struct {
	cfg    config.Config
	pricer *pricer.Client
}

func NewAnalyticsHandler(cfg config.Config, p *pricer.Client) *AnalyticsHandler {
	return &AnalyticsHandler{cfg: cfg, pricer: p}
}

func (h *AnalyticsHandler) Get(c *gin.Context) {
	txs, err := loader.LoadExport(h.cfg.ExportsDir, c.Query("export"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	raw := service.ComputeHoldings(txs)
	isins := make([]string, 0, len(raw))
	for isin := range raw {
		isins = append(isins, isin)
	}
	prices, _ := h.pricer.GetPrices(isins)
	if prices == nil {
		prices = map[string]float64{}
	}
	holdings := service.EnrichWithPrices(raw, prices)

	// Sector breakdown from current market values
	sectorMap := map[string]float64{}
	for _, h := range holdings {
		ac := h.AssetClass
		if ac == "" {
			ac = "Other"
		}
		mv := 0.0
		if h.MarketValue != nil {
			mv = *h.MarketValue
		} else {
			mv = h.CostBasis
		}
		sectorMap[ac] += mv
	}
	sectors := make([]model.SectorItem, 0, len(sectorMap))
	for label, value := range sectorMap {
		sectors = append(sectors, model.SectorItem{Label: label, Value: value})
	}

	// Build the payload for the pricer analytics endpoint (TRADING txs only)
	pricerTxs := make([]pricer.AnalyticsTx, 0, len(txs))
	for _, tx := range txs {
		if tx.Category != "TRADING" || tx.ISIN == "" {
			continue
		}
		if math.Abs(tx.Shares) < 1e-9 {
			continue
		}
		pricerTxs = append(pricerTxs, pricer.AnalyticsTx{
			Date:   tx.Date,
			ISIN:   tx.ISIN,
			Shares: tx.Shares,
			Amount: tx.Amount,
			Type:   tx.Type,
		})
	}

	// Defaults for when the pricer call fails or returns nothing
	monthly := map[string]map[string]float64{}
	var annual []pricer.AnnualEntry
	var sharpe *float64
	var volatility *float64
	maxDDDays := 0
	var pnlSeries []pricer.PnLPoint

	if result, pErr := h.pricer.PostPortfolioAnalytics(pricerTxs); pErr == nil && result != nil {
		monthly = result.Monthly
		annual = result.Annual
		sharpe = result.Sharpe
		volatility = result.Volatility
		maxDDDays = result.MaxDDDays
		pnlSeries = result.PnLSeries
	}

	if annual == nil {
		annual = []pricer.AnnualEntry{}
	}
	if pnlSeries == nil {
		pnlSeries = []pricer.PnLPoint{}
	}
	if monthly == nil {
		monthly = map[string]map[string]float64{}
	}

	c.JSON(http.StatusOK, gin.H{
		"monthly":     monthly,
		"annual":      annual,
		"sharpe":      sharpe,
		"volatility":  volatility,
		"max_dd_days": maxDDDays,
		"sectors":     sectors,
		"pnl_series":  pnlSeries,
	})
}
