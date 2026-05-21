package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/db"
	"github.com/manimovassagh/portfolio/internal/model"
)

type WatchlistHandler struct {
	store *db.Store
}

func NewWatchlistHandler(store *db.Store) *WatchlistHandler {
	return &WatchlistHandler{store: store}
}

func (h *WatchlistHandler) Get(c *gin.Context) {
	items, err := h.store.GetWatchlist()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Watchlist{Items: items})
}

func (h *WatchlistHandler) Add(c *gin.Context) {
	var item model.WatchlistItem
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.ISIN = strings.ToUpper(strings.TrimSpace(item.ISIN))
	item.Ticker = strings.ToUpper(strings.TrimSpace(item.Ticker))
	item.Name = strings.TrimSpace(item.Name)
	item.Notes = strings.TrimSpace(item.Notes)
	if item.ISIN == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "isin is required"})
		return
	}
	if item.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if item.AddedDate == "" {
		item.AddedDate = time.Now().Format("2006-01-02")
	}
	if err := h.store.AddWatchlistItem(item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	items, err := h.store.GetWatchlist()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Watchlist{Items: items})
}

func (h *WatchlistHandler) Remove(c *gin.Context) {
	isin := strings.ToUpper(strings.TrimSpace(c.Param("isin")))
	if isin == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "isin is required"})
		return
	}
	if err := h.store.RemoveWatchlistItem(isin); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	items, err := h.store.GetWatchlist()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, model.Watchlist{Items: items})
}
