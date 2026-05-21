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

type AssetHandler struct {
	cfg    config.Config
	pricer *pricer.Client
}

func NewAssetHandler(cfg config.Config, p *pricer.Client) *AssetHandler {
	return &AssetHandler{cfg: cfg, pricer: p}
}

func (h *AssetHandler) Get(c *gin.Context) {
	isin := c.Param("isin")
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

	// Collect transactions for this ISIN (all categories for full history).
	var rows []model.TxRow
	var firstName, firstClass string
	for _, tx := range txs {
		if tx.ISIN != isin {
			continue
		}
		if firstName == "" {
			firstName = tx.Name
			firstClass = tx.AssetClass
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
	if firstName == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "no transactions for ISIN " + isin})
		return
	}
	if rows == nil {
		rows = []model.TxRow{}
	}

	raw := service.ComputeHoldings(txs)
	holding, hasPos := raw[isin]

	prices, _ := h.pricer.GetPrices([]string{isin})
	if prices == nil {
		prices = map[string]float64{}
	}

	var curPrice, mv, unrealized *float64
	shares := 0.0
	avgCost := 0.0
	costBasis := 0.0
	if hasPos {
		shares = holding.Shares
		avgCost = holding.AvgCost
		costBasis = holding.CostBasis
	}
	if p, ok := prices[isin]; ok {
		cp := p
		curPrice = &cp
		if hasPos {
			m := p * shares
			u := m - costBasis
			mv = &m
			unrealized = &u
		}
	}

	c.JSON(http.StatusOK, model.AssetDetailV2{
		ISIN:         isin,
		Name:         firstName,
		AssetClass:   firstClass,
		Transactions: rows,
		Current: model.AssetCurrentInfo{
			Shares:       shares,
			AvgCost:      avgCost,
			CostBasis:    costBasis,
			CurrentPrice: curPrice,
			MarketValue:  mv,
			Unrealized:   unrealized,
		},
	})
}
