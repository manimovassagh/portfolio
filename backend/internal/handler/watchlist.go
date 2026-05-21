package handler

import (
	"math"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/db"
	"github.com/manimovassagh/portfolio/internal/model"
	"github.com/manimovassagh/portfolio/internal/pricer"
)

var isinRE = regexp.MustCompile(`^[A-Z]{2}[A-Z0-9]{10}$`)

type WatchlistHandler struct {
	store  *db.Store
	pricer *pricer.Client
}

func NewWatchlistHandler(store *db.Store, p *pricer.Client) *WatchlistHandler {
	return &WatchlistHandler{store: store, pricer: p}
}

func (h *WatchlistHandler) Get(c *gin.Context) {
	items, err := h.store.GetWatchlist()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Collect ISINs for live price enrichment.
	isins := make([]string, 0, len(items))
	for _, it := range items {
		if it.ISIN != "" {
			isins = append(isins, it.ISIN)
		}
	}
	prices, _ := h.pricer.GetPrices(isins) // best-effort; nil prices are fine

	for i, it := range items {
		if p, ok := prices[it.ISIN]; ok {
			v := p
			items[i].CurrentPrice = &v
		}
	}

	// Sort by distance to target ascending (closest first), items without a
	// target price float to the end.
	sort.SliceStable(items, func(i, j int) bool {
		di := distToTarget(items[i])
		dj := distToTarget(items[j])
		if di < 0 && dj < 0 {
			return false
		}
		if di < 0 {
			return false
		}
		if dj < 0 {
			return true
		}
		return di < dj
	})

	c.JSON(http.StatusOK, model.Watchlist{Items: items})
}

// distToTarget returns the fractional distance from current price to target,
// or -1 if either value is unavailable.
func distToTarget(it model.WatchlistItem) float64 {
	if it.CurrentPrice == nil || it.TargetPrice == nil || *it.TargetPrice == 0 {
		return -1
	}
	return math.Abs(*it.CurrentPrice-*it.TargetPrice) / *it.TargetPrice
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
	if !isinRE.MatchString(item.ISIN) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "isin must be 12 uppercase alphanumeric characters (e.g. IE00B4L5Y983)"})
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
