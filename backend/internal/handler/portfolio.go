package handler

import (
	"net/http"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
	"github.com/manimovassagh/portfolio/internal/model"
	"github.com/manimovassagh/portfolio/internal/pricer"
	"github.com/manimovassagh/portfolio/internal/service"
)

type PortfolioHandler struct {
	cfg    config.Config
	pricer *pricer.Client
}

func NewPortfolioHandler(cfg config.Config, p *pricer.Client) *PortfolioHandler {
	return &PortfolioHandler{cfg: cfg, pricer: p}
}

func (h *PortfolioHandler) Overview(c *gin.Context) {
	csvPath, err := loader.ResolveExport(h.cfg.ExportsDir, c.Query("export"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	txs, err := loader.Load(csvPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
	summary := service.BuildSummary(holdings, txs)

	c.JSON(http.StatusOK, summary)
}

func (h *PortfolioHandler) Summary(c *gin.Context) {
	csvPath, err := loader.ResolveExport(h.cfg.ExportsDir, c.Query("export"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	txs, err := loader.Load(csvPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	raw, realized := service.ComputeHoldingsAndRealized(txs)
	isins := make([]string, 0, len(raw))
	for isin := range raw {
		isins = append(isins, isin)
	}
	prices, _ := h.pricer.GetPrices(isins)
	if prices == nil {
		prices = map[string]float64{}
	}
	holdings := service.EnrichWithPrices(raw, prices)
	cash := service.ComputeCash(txs)

	marketValue := 0.0
	costBasis := 0.0
	for _, h := range holdings {
		if h.MarketValue != nil {
			marketValue += *h.MarketValue
		}
		costBasis += h.CostBasis
	}
	portfolioValue := marketValue + cash.CashBalance
	unrealized := marketValue - costBasis
	unrealizedPct := 0.0
	if costBasis > 0 {
		unrealizedPct = unrealized / costBasis * 100
	}
	realizedPnL := 0.0
	for _, r := range realized {
		realizedPnL += r.PnL
	}
	totalReturn := 0.0
	if cash.NetDeposits() > 0 {
		totalReturn = (portfolioValue - cash.NetDeposits()) / cash.NetDeposits()
	}

	xirr := service.XIRR(txs, portfolioValue)

	resp := model.SummaryResponse{
		Export:         filepath.Base(csvPath),
		PortfolioValue: portfolioValue,
		MarketValue:    marketValue,
		CashBalance:    cash.CashBalance,
		CostBasis:      costBasis,
		NetDeposits:    cash.NetDeposits(),
		Deposits:       cash.Deposits,
		Withdrawals:    cash.Withdrawals,
		UnrealizedPnL:  unrealized,
		UnrealizedPct:  unrealizedPct,
		RealizedPnL:    realizedPnL,
		TotalReturn:    totalReturn,
		XIRR:           xirr,
		Dividends:      cash.Dividends,
		Interest:       cash.Interest,
		StockPerks:     cash.StockPerks,
		Fees:           cash.Fees,
		Tax:            cash.Tax,
		NHoldings:      len(holdings),
		NRealized:      len(realized),
		HolderName:     service.HolderName(txs),
		FirstTradeDate: service.FirstTradeDate(txs),
	}
	c.JSON(http.StatusOK, resp)
}
