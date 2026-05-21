package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
	"github.com/manimovassagh/portfolio/internal/service"
)

type CashFlowHandler struct {
	cfg config.Config
}

func NewCashFlowHandler(cfg config.Config) *CashFlowHandler {
	return &CashFlowHandler{cfg: cfg}
}

func (h *CashFlowHandler) Get(c *gin.Context) {
	txs, err := loader.LoadExport(h.cfg.ExportsDir, c.Query("export"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	cash := service.ComputeCash(txs)
	balance := service.CashBalanceOverTime(txs)

	buckets := []gin.H{
		{"label": "Deposits", "value": cash.Deposits},
		{"label": "Withdrawals", "value": -cash.Withdrawals},
		{"label": "Dividends", "value": cash.Dividends},
		{"label": "Interest", "value": cash.Interest},
		{"label": "Stock perks", "value": cash.StockPerks},
		{"label": "Fees", "value": -cash.Fees},
		{"label": "Tax", "value": -cash.Tax},
		{"label": "Net invested", "value": -cash.Invested},
	}

	c.JSON(http.StatusOK, gin.H{
		"balance": balance,
		"buckets": buckets,
	})
}
