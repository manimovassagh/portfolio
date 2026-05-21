package handler

import (
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
	"github.com/manimovassagh/portfolio/internal/pricer"
	"github.com/manimovassagh/portfolio/internal/service"
)

type MiscHandler struct {
	cfg    config.Config
	pricer *pricer.Client
}

func NewMiscHandler(cfg config.Config, p *pricer.Client) *MiscHandler {
	return &MiscHandler{cfg: cfg, pricer: p}
}

func (h *MiscHandler) PositionReturns(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"returns": gin.H{}})
}

func (h *MiscHandler) Performance(c *gin.Context) {
	csvPath, err := loader.ResolveExport(h.cfg.ExportsDir, c.Query("export"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	txs, err := loader.Load(csvPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	pricerTxs := make([]pricer.AnalyticsTx, 0, len(txs))
	for _, tx := range txs {
		if tx.Category != "TRADING" || tx.ISIN == "" || math.Abs(tx.Shares) < 1e-9 {
			continue
		}
		pricerTxs = append(pricerTxs, pricer.AnalyticsTx{
			Date: tx.Date, ISIN: tx.ISIN,
			Shares: tx.Shares, Amount: tx.Amount, Type: tx.Type,
		})
	}

	benchmarkTicker := c.Query("benchmark") // e.g. "URTH" or "CSPX.L"

	series := []pricer.PerfPoint{}
	drawdown := []pricer.DDPoint{}
	twr := []pricer.TWRPoint{}
	benchmark := []pricer.TWRPoint{}

	if perf, pErr := h.pricer.PostPortfolioPerformance(pricerTxs, benchmarkTicker); pErr == nil && perf != nil {
		if perf.Series != nil {
			series = perf.Series
		}
		if perf.Drawdown != nil {
			drawdown = perf.Drawdown
		}
		if perf.TWR != nil {
			twr = perf.TWR
		}
		if perf.Benchmark != nil {
			benchmark = perf.Benchmark
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"series":    series,
		"drawdown":  drawdown,
		"twr":       twr,
		"benchmark": benchmark,
		"best_worst": gin.H{
			"best":  []gin.H{},
			"worst": []gin.H{},
		},
	})
}

// Geographic returns portfolio value grouped by issuing country from ISIN prefix.
func (h *MiscHandler) Geographic(c *gin.Context) {
	csvPath, err := loader.ResolveExport(h.cfg.ExportsDir, c.Query("export"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"countries": []gin.H{}})
		return
	}
	txs, err := loader.Load(csvPath)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"countries": []gin.H{}})
		return
	}
	holdings := service.ComputeHoldings(txs)
	isins := make([]string, 0, len(holdings))
	for isin := range holdings {
		isins = append(isins, isin)
	}
	prices, _ := h.pricer.GetPrices(isins)
	enriched := service.EnrichWithPrices(holdings, prices)

	byCountry := map[string]float64{}
	for _, h := range enriched {
		if len(h.ISIN) < 2 {
			continue
		}
		code := strings.ToUpper(h.ISIN[:2])
		mv := 0.0
		if h.MarketValue != nil {
			mv = *h.MarketValue
		}
		byCountry[code] += mv
	}

	countries := make([]gin.H, 0, len(byCountry))
	for code, val := range byCountry {
		countries = append(countries, gin.H{
			"code":  code,
			"name":  isoCountryName(code),
			"value": math.Round(val*100) / 100,
		})
	}
	sort.Slice(countries, func(i, j int) bool {
		return countries[i]["value"].(float64) > countries[j]["value"].(float64)
	})
	c.JSON(http.StatusOK, gin.H{"countries": countries})
}

// isoCountryName maps ISO 3166-1 alpha-2 codes to English country names.
// Covers the most common issuing countries for European retail ETFs and stocks.
func isoCountryName(code string) string {
	names := map[string]string{
		"IE": "Ireland", "DE": "Germany", "FR": "France", "GB": "United Kingdom",
		"NL": "Netherlands", "LU": "Luxembourg", "US": "United States",
		"CH": "Switzerland", "SE": "Sweden", "DK": "Denmark", "NO": "Norway",
		"FI": "Finland", "IT": "Italy", "ES": "Spain", "AT": "Austria",
		"BE": "Belgium", "PT": "Portugal", "PL": "Poland", "CZ": "Czech Republic",
		"HU": "Hungary", "JP": "Japan", "CN": "China", "HK": "Hong Kong",
		"SG": "Singapore", "AU": "Australia", "CA": "Canada", "BR": "Brazil",
		"IN": "India", "KR": "South Korea", "TW": "Taiwan", "ZA": "South Africa",
		"MX": "Mexico", "RU": "Russia", "SA": "Saudi Arabia", "AE": "UAE",
	}
	if n, ok := names[code]; ok {
		return n
	}
	return code
}

// FSA computes the German Freistellungsauftrag (tax-free allowance) usage.
func (h *MiscHandler) FSA(c *gin.Context) {
	csvPath, err := loader.ResolveExport(h.cfg.ExportsDir, c.Query("export"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	txs, err := loader.Load(csvPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	year := time.Now().Year()
	cash := service.ComputeCash(txs)

	// Vorabpauschale from EARNINGS type transactions in the current year
	var vorab float64
	var realizedGains float64
	_, realized := service.ComputeHoldingsAndRealized(txs)
	for _, r := range realized {
		if r.Date != nil && strings.HasPrefix(*r.Date, strings.Fields(time.Now().Format("2006"))[0]) {
			if r.PnL > 0 {
				realizedGains += r.PnL
			}
		}
	}
	for _, tx := range txs {
		if strings.ToUpper(tx.Type) == "EARNINGS" && strings.HasPrefix(tx.Date, time.Now().Format("2006")) {
			vorab += math.Abs(tx.Tax)
		}
	}

	// German FSA limit: 1000 EUR single, 2000 EUR joint
	joint := c.Query("joint") == "true"
	limit := 1000.0
	if joint {
		limit = 2000.0
	}
	used := cash.Dividends + cash.Interest + cash.StockPerks + vorab + realizedGains
	if used < 0 {
		used = 0
	}
	remaining := limit - used
	if remaining < 0 {
		remaining = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"year":  year,
		"limit": limit,
		"used":  used,
		"remaining": remaining,
		"breakdown": gin.H{
			"dividends":      cash.Dividends,
			"interest":       cash.Interest,
			"stockperks":     cash.StockPerks,
			"vorabpauschale": vorab,
			"realized_gains": realizedGains,
		},
	})
}

// DividendCalendar returns upcoming dividends based on past dividend history.
func (h *MiscHandler) DividendCalendar(c *gin.Context) {
	csvPath, err := loader.ResolveExport(h.cfg.ExportsDir, c.Query("export"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	txs, err := loader.Load(csvPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Find the most recent dividend per ISIN held in current positions.
	raw := service.ComputeHoldings(txs)
	type divRecord struct {
		isin   string
		name   string
		date   string
		amount float64
	}
	latest := map[string]divRecord{}
	for _, tx := range txs {
		if strings.ToUpper(tx.Type) != "DIVIDEND" || tx.ISIN == "" {
			continue
		}
		if _, held := raw[tx.ISIN]; !held {
			continue
		}
		prev, ok := latest[tx.ISIN]
		if !ok || tx.Date > prev.date {
			latest[tx.ISIN] = divRecord{isin: tx.ISIN, name: tx.Name, date: tx.Date, amount: tx.Amount}
		}
	}

	upcoming := make([]gin.H, 0, len(latest))
	for _, r := range latest {
		upcoming = append(upcoming, gin.H{
			"isin":               r.isin,
			"name":               r.name,
			"last_dividend_date": r.date,
			"last_amount":        r.amount,
		})
	}

	c.JSON(http.StatusOK, gin.H{"upcoming": upcoming})
}

// RefreshPrices is a no-op — prices are fetched on-demand from the pricer.
func (h *MiscHandler) RefreshPrices(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

const maxUploadBytes = 10 * 1024 * 1024

// Upload accepts a CSV export file and saves it to the exports directory.
func (h *MiscHandler) Upload(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing file"})
		return
	}
	defer file.Close()

	name := filepath.Base(header.Filename)
	if !strings.HasSuffix(strings.ToLower(name), ".csv") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only CSV files accepted"})
		return
	}
	if strings.Contains(name, "..") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid filename"})
		return
	}

	data, err := io.ReadAll(io.LimitReader(file, maxUploadBytes+1))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "read failed"})
		return
	}
	if len(data) > maxUploadBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file too large (max 10 MB)"})
		return
	}

	if err := os.MkdirAll(h.cfg.ExportsDir, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot create exports dir"})
		return
	}
	dest := filepath.Join(h.cfg.ExportsDir, name)
	if err := os.WriteFile(dest, data, 0o644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "write failed"})
		return
	}

	paths := loader.ListExports(h.cfg.ExportsDir)
	names := make([]string, len(paths))
	for i, p := range paths {
		names[i] = filepath.Base(p)
	}
	c.JSON(http.StatusOK, gin.H{"filename": name, "exports": names})
}
