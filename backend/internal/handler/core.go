package handler

import (
	"net/http"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
)

type CoreHandler struct {
	cfg config.Config
}

func NewCoreHandler(cfg config.Config) *CoreHandler {
	return &CoreHandler{cfg: cfg}
}

func (h *CoreHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *CoreHandler) Exports(c *gin.Context) {
	paths := loader.ListExports(h.cfg.ExportsDir)
	names := make([]string, len(paths))
	for i, p := range paths {
		names[i] = filepath.Base(p)
	}
	c.JSON(http.StatusOK, gin.H{"exports": names})
}
