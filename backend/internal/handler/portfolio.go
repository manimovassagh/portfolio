package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
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
	csvPath, err := loader.LatestExport(h.cfg.ExportsDir)
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
