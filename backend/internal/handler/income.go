package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/model"
	"github.com/manimovassagh/portfolio/internal/service"
)

type IncomeHandler struct {
	cfg config.Config
}

func NewIncomeHandler(cfg config.Config) *IncomeHandler {
	return &IncomeHandler{cfg: cfg}
}

func (h *IncomeHandler) Get(c *gin.Context) {
	txs, err := loadUserExport(h.cfg, currentUserID(c), c.Query("export"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	log := service.IncomeLog(txs)
	if log == nil {
		log = []model.IncomeLine{}
	}
	cash := service.ComputeCash(txs)

	c.JSON(http.StatusOK, gin.H{
		"log": log,
		"totals": gin.H{
			"dividends":  cash.Dividends,
			"interest":   cash.Interest,
			"stockperks": cash.StockPerks,
		},
	})
}
