package handler

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
)

type CoreHandler struct {
	cfg    config.Config
	store  interface{ Ping() error }
	pricer interface{ Health() error }
}

func NewCoreHandler(cfg config.Config, store interface{ Ping() error }, pricer interface{ Health() error }) *CoreHandler {
	return &CoreHandler{cfg: cfg, store: store, pricer: pricer}
}

func (h *CoreHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (h *CoreHandler) Readyz(c *gin.Context) {
	checks := map[string]string{}
	allOK := true

	if err := h.store.Ping(); err != nil {
		checks["db"] = err.Error()
		allOK = false
	} else {
		checks["db"] = "ok"
	}

	if _, err := os.Stat(h.cfg.ExportsDir); err != nil {
		checks["exports"] = err.Error()
		allOK = false
	} else {
		checks["exports"] = "ok"
	}

	if err := h.pricer.Health(); err != nil {
		checks["pricer"] = err.Error()
		allOK = false
	} else {
		checks["pricer"] = "ok"
	}

	if allOK {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "checks": checks})
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "degraded", "checks": checks})
	}
}

func (h *CoreHandler) Exports(c *gin.Context) {
	paths := loader.ListExports(h.cfg.ExportsDir)
	names := make([]string, len(paths))
	for i, p := range paths {
		names[i] = filepath.Base(p)
	}
	c.JSON(http.StatusOK, gin.H{"exports": names})
}
