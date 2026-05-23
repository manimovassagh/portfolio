package handler

import (
	"encoding/csv"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/model"
	"github.com/manimovassagh/portfolio/internal/pricer"
	"github.com/manimovassagh/portfolio/internal/service"
)

type HoldingsHandler struct {
	cfg    config.Config
	pricer *pricer.Client
}

func NewHoldingsHandler(cfg config.Config, p *pricer.Client) *HoldingsHandler {
	return &HoldingsHandler{cfg: cfg, pricer: p}
}

func (h *HoldingsHandler) loadAndEnrich(userID, exportName string) ([]model.Holding, error) {
	txs, err := loadUserExport(h.cfg, userID, exportName)
	if err != nil {
		return nil, err
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
	return service.EnrichWithPrices(raw, prices), nil
}

func (h *HoldingsHandler) List(c *gin.Context) {
	holdings, err := h.loadAndEnrich(currentUserID(c), c.Query("export"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	totalMV := 0.0
	for _, holding := range holdings {
		if holding.MarketValue != nil {
			totalMV += *holding.MarketValue
		}
	}

	var totalMVPtr *float64
	if totalMV > 0 {
		totalMVPtr = &totalMV
	}

	c.JSON(http.StatusOK, gin.H{
		"holdings":           holdings,
		"total_market_value": totalMVPtr,
	})
}

func (h *HoldingsHandler) Detail(c *gin.Context) {
	isin := c.Param("isin")
	txs, err := loadUserExport(h.cfg, currentUserID(c), c.Query("export"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	raw := service.ComputeHoldings(txs)
	holding, ok := raw[isin]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	prices, _ := h.pricer.GetPrices([]string{isin})
	if prices == nil {
		prices = map[string]float64{}
	}
	enriched := service.EnrichWithPrices(map[string]model.Holding{isin: holding}, prices)

	var rows []model.TxRow
	for _, tx := range txs {
		if tx.ISIN != isin || tx.Category != "TRADING" {
			continue
		}
		tx := tx
		var shares, price, amount, fee, tax *float64
		if math.Abs(tx.Shares) > 1e-9 {
			shares = &tx.Shares
		}
		if tx.Price != 0 {
			price = &tx.Price
		}
		if tx.Amount != 0 {
			amount = &tx.Amount
		}
		if tx.Fee != 0 {
			fee = &tx.Fee
		}
		if tx.Tax != 0 {
			tax = &tx.Tax
		}
		rows = append(rows, model.TxRow{
			Date: tx.Date, Type: tx.Type,
			Shares: shares, Price: price, Amount: amount,
			Fee: fee, Tax: tax, Description: tx.Description,
		})
	}
	if rows == nil {
		rows = []model.TxRow{}
	}

	c.JSON(http.StatusOK, model.AssetDetail{
		ISIN:         isin,
		Name:         holding.Name,
		AssetClass:   holding.AssetClass,
		Current:      enriched[0],
		Transactions: rows,
	})
}

func (h *HoldingsHandler) Export(c *gin.Context) {
	holdings, err := h.loadAndEnrich(currentUserID(c), c.Query("export"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	filename := fmt.Sprintf("holdings-%s.csv", time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{
		"ISIN", "Name", "Shares", "Avg Cost", "Current Price",
		"Market Value", "Unrealized P&L", "P&L %", "Weight",
	})

	fmtF := func(v *float64) string {
		if v == nil {
			return ""
		}
		return fmt.Sprintf("%.2f", *v)
	}

	for _, h := range holdings {
		_ = w.Write([]string{
			h.ISIN,
			h.Name,
			fmt.Sprintf("%.2f", h.Shares),
			fmt.Sprintf("%.2f", h.AvgCost),
			fmtF(h.CurrentPrice),
			fmtF(h.MarketValue),
			fmtF(h.UnrealizedPnL),
			fmtF(h.UnrealizedPct),
			fmt.Sprintf("%.2f", h.Weight),
		})
	}

	w.Flush()
}
