package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
)

type MarketHandler struct {
	cfg        config.Config
	httpClient *http.Client
}

func NewMarketHandler(cfg config.Config) *MarketHandler {
	return &MarketHandler{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (h *MarketHandler) pricerGet(path string, params url.Values) (any, error) {
	u := fmt.Sprintf("%s%s?%s", h.cfg.PricerURL, path, params.Encode())
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pricer returned %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
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
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "q is required", "results": []any{}})
		return
	}
	result, err := h.pricerGet("/search", url.Values{"q": {q}})
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"results": []any{}})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *MarketHandler) Quote(c *gin.Context) {
	ticker := strings.TrimSpace(c.Query("ticker"))
	if ticker == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ticker is required"})
		return
	}
	result, err := h.pricerGet("/quote", url.Values{"ticker": {ticker}})
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *MarketHandler) History(c *gin.Context) {
	ticker := strings.TrimSpace(c.Query("ticker"))
	if ticker == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ticker is required", "series": []any{}})
		return
	}
	rangeParam := strings.TrimSpace(c.Query("range"))
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
	ticker := strings.TrimSpace(c.Query("ticker"))
	if ticker == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ticker is required", "news": []any{}})
		return
	}
	result, err := h.pricerGet("/news", url.Values{"ticker": {ticker}})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"news": []any{}})
		return
	}
	c.JSON(http.StatusOK, result)
}
