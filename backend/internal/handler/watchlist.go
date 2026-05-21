package handler

import (
	"net/http"
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
	if item.AddedDate == "" {
		item.AddedDate = time.Now().Format("2006-01-02")
	}
	if err := h.store.AddWatchlistItem(item); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "added"})
}

func (h *WatchlistHandler) Remove(c *gin.Context) {
	isin := c.Param("isin")
	if err := h.store.RemoveWatchlistItem(isin); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}
