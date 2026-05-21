package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
)

type MarketHandler struct {
	cfg config.Config
}

func NewMarketHandler(cfg config.Config) *MarketHandler {
	return &MarketHandler{cfg: cfg}
}

func (h *MarketHandler) pricerGet(path string, params url.Values) (any, error) {
	u := fmt.Sprintf("%s%s?%s", h.cfg.PricerURL, path, params.Encode())
	resp, err := http.Get(u) //nolint:gosec
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var result any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (h *MarketHandler) Search(c *gin.Context) {
	q := c.Query("q")
	result, err := h.pricerGet("/search", url.Values{"q": {q}})
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"results": []any{}})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *MarketHandler) Quote(c *gin.Context) {
	ticker := c.Query("ticker")
	result, err := h.pricerGet("/quote", url.Values{"ticker": {ticker}})
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *MarketHandler) History(c *gin.Context) {
	ticker := c.Query("ticker")
	rangeParam := c.Query("range")
	if rangeParam == "" {
		rangeParam = "1M"
	}
	result, err := h.pricerGet("/history", url.Values{"ticker": {ticker}, "range": {rangeParam}})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"series": []any{}})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *MarketHandler) News(c *gin.Context) {
	ticker := c.Query("ticker")
	result, err := h.pricerGet("/news", url.Values{"ticker": {ticker}})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"news": []any{}})
		return
	}
	c.JSON(http.StatusOK, result)
}
