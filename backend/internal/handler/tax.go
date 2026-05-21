package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
	"github.com/manimovassagh/portfolio/internal/model"
	"github.com/manimovassagh/portfolio/internal/service"
)

type TaxHandler struct {
	cfg config.Config
}

func NewTaxHandler(cfg config.Config) *TaxHandler {
	return &TaxHandler{cfg: cfg}
}

func (h *TaxHandler) Get(c *gin.Context) {
	txs, err := loader.LoadExport(h.cfg.ExportsDir, c.Query("export"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	records := service.TaxLog(txs)
	if records == nil {
		records = []model.TaxLine{}
	}

	c.JSON(http.StatusOK, gin.H{"records": records})
}
