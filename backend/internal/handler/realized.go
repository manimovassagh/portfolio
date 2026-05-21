package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
	"github.com/manimovassagh/portfolio/internal/model"
	"github.com/manimovassagh/portfolio/internal/service"
)

type RealizedHandler struct {
	cfg config.Config
}

func NewRealizedHandler(cfg config.Config) *RealizedHandler {
	return &RealizedHandler{cfg: cfg}
}

func (h *RealizedHandler) Get(c *gin.Context) {
	txs, err := loader.LoadExport(h.cfg.ExportsDir, c.Query("export"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	_, realized := service.ComputeHoldingsAndRealized(txs)
	if realized == nil {
		realized = []model.RealizedEntry{}
	}

	total := 0.0
	for _, r := range realized {
		total += r.PnL
	}

	c.JSON(http.StatusOK, gin.H{
		"realized": realized,
		"total":    total,
	})
}
