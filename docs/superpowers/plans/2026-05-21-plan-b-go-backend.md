# Plan B: Go Backend (Gin)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Go/Gin backend under `backend/` that reimplements every API route currently served by Python/FastAPI, reading from the same SQLite watchlist DB and CSV exports, calling the Python pricer for live prices.

**Architecture:** Layered: `handler/` (HTTP only) → `service/` (business logic) → `db/` + `pricer/` (data sources). All domain types in `model/`. Config from env vars. Gin router with middleware. One route migrated per commit, existing Python app stays running in parallel until all routes are done.

**Tech Stack:** Go 1.22+, Gin v1, modernc.org/sqlite (pure Go, no CGO), standard library for HTTP client

**CSV columns (Trade Republic export):**
`datetime, date, account_type, category, type, asset_class, name, symbol, shares, price, amount, fee, tax, currency, original_amount, original_currency, fx_rate, description, transaction_id, ...`

**SQLite schema:**
```sql
CREATE TABLE watchlist (
    isin        TEXT PRIMARY KEY,
    ticker      TEXT NOT NULL DEFAULT '',
    name        TEXT NOT NULL DEFAULT '',
    notes       TEXT NOT NULL DEFAULT '',
    target_price REAL,
    added_date  TEXT NOT NULL
);
```

---

### Task 1: Scaffold Go module and directory structure

**Files:**
- Create: `backend/go.mod`
- Create: `backend/go.sum`
- Create: `backend/cmd/api/main.go`
- Create: `backend/internal/config/config.go`
- Create: `backend/internal/middleware/middleware.go`
- Create: `backend/Makefile`

- [ ] **Step 1: Initialize Go module**

```bash
mkdir -p backend
cd backend
go mod init github.com/manimovassagh/portfolio
go get github.com/gin-gonic/gin@v1.10.0
go get modernc.org/sqlite@latest
go mod tidy
cd ..
```

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p backend/cmd/api
mkdir -p backend/internal/{config,middleware,model,db,pricer,service,handler}
```

- [ ] **Step 3: Create `backend/internal/config/config.go`**

```go
package config

import "os"

type Config struct {
	Port      string
	DBPath    string
	PricerURL string
	TLSCert   string
	TLSKey    string
	ExportsDir string
}

func Load() Config {
	return Config{
		Port:       getEnv("PORT", "8766"),
		DBPath:     getEnv("DB_PATH", "../portfolio.db"),
		PricerURL:  getEnv("PRICER_URL", "http://localhost:8001"),
		TLSCert:    getEnv("TLS_CERT", "../certs/cert.pem"),
		TLSKey:     getEnv("TLS_KEY", "../certs/key.pem"),
		ExportsDir: getEnv("EXPORTS_DIR", "../exports"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

- [ ] **Step 4: Create `backend/internal/middleware/middleware.go`**

```go
package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)
		gin.DefaultWriter.Write([]byte(
			c.Request.Method + " " + c.Request.URL.Path +
				" " + time.Now().Format(time.RFC3339) +
				" " + duration.String() + "\n",
		))
	}
}
```

- [ ] **Step 5: Create `backend/cmd/api/main.go`**

```go
package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/middleware"
)

func main() {
	cfg := config.Load()

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	api := r.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	log.Printf("Go backend starting on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 6: Create `backend/Makefile`**

```makefile
.PHONY: build run test lint tidy

build:
	go build -o bin/api ./cmd/api

run:
	go run ./cmd/api

test:
	go test ./... -v

lint:
	golangci-lint run ./...

tidy:
	go mod tidy
```

- [ ] **Step 7: Build and smoke test**

```bash
cd backend
go build ./cmd/api
./api &
sleep 1
curl http://localhost:8766/api/health
# Expected: {"status":"ok"}
pkill api
cd ..
```

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: scaffold go backend with gin, config, and middleware"
```

---

### Task 2: Domain model types

**Files:**
- Create: `backend/internal/model/types.go`

- [ ] **Step 1: Create `backend/internal/model/types.go`**

```go
package model

// Transaction is one row from the Trade Republic CSV export.
type Transaction struct {
	DateTime    string  `json:"datetime"`
	Date        string  `json:"date"`
	Category    string  `json:"category"`
	Type        string  `json:"type"`
	AssetClass  string  `json:"asset_class"`
	Name        string  `json:"name"`
	ISIN        string  `json:"isin"`
	Shares      float64 `json:"shares"`
	Price       float64 `json:"price"`
	Amount      float64 `json:"amount"`
	Fee         float64 `json:"fee"`
	Tax         float64 `json:"tax"`
	Description string  `json:"description"`
}

// Holding is the computed current state of one position.
type Holding struct {
	ISIN          string   `json:"isin"`
	Name          string   `json:"name"`
	AssetClass    string   `json:"asset_class"`
	Shares        float64  `json:"shares"`
	AvgCost       float64  `json:"avg_cost"`
	CostBasis     float64  `json:"cost_basis"`
	CurrentPrice  *float64 `json:"current_price"`
	MarketValue   *float64 `json:"market_value"`
	UnrealizedPnL *float64 `json:"unrealized_pnl"`
	UnrealizedPct *float64 `json:"unrealized_pct"`
	Weight        float64  `json:"weight"`
	FeesPaid      float64  `json:"fees_paid"`
	TTMDividend   float64  `json:"ttm_dividend"`
	TTMYield      *float64 `json:"ttm_yield"`
}

// TxRow is a transaction row as returned in the asset detail modal.
type TxRow struct {
	Date        string   `json:"date"`
	Type        string   `json:"type"`
	Shares      *float64 `json:"shares"`
	Price       *float64 `json:"price"`
	Amount      *float64 `json:"amount"`
	Fee         *float64 `json:"fee"`
	Tax         *float64 `json:"tax"`
	Description string   `json:"description"`
}

// AssetDetail is the full detail for one position (used in modal).
type AssetDetail struct {
	ISIN         string   `json:"isin"`
	Name         string   `json:"name"`
	AssetClass   string   `json:"asset_class"`
	Current      Holding  `json:"current"`
	Transactions []TxRow  `json:"transactions"`
}

// WatchlistItem is one row from the SQLite watchlist table.
type WatchlistItem struct {
	ISIN        string   `json:"isin"`
	Ticker      string   `json:"ticker"`
	Name        string   `json:"name"`
	Notes       string   `json:"notes"`
	TargetPrice *float64 `json:"target_price"`
	AddedDate   string   `json:"added_date"`
}

// Watchlist wraps the list for JSON envelope consistency.
type Watchlist struct {
	Items []WatchlistItem `json:"items"`
}

// PortfolioSummary is the overview dashboard response.
type PortfolioSummary struct {
	PortfolioValue   *float64  `json:"portfolio_value"`
	TotalInvested    float64   `json:"total_invested"`
	TotalPnL         *float64  `json:"total_pnl"`
	TotalPnLPct      *float64  `json:"total_pnl_pct"`
	TotalFees        float64   `json:"total_fees"`
	TotalTax         float64   `json:"total_tax"`
	TotalMarketValue *float64  `json:"total_market_value"`
	Holdings         []Holding `json:"holdings"`
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./... && echo "OK" && cd ..
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/internal/model/
git commit -m "feat(go): domain model types"
```

---

### Task 3: CSV loader (reads Trade Republic exports)

**Files:**
- Create: `backend/internal/loader/loader.go`
- Create: `backend/internal/loader/loader_test.go`

- [ ] **Step 1: Create `backend/internal/loader/loader_test.go`**

```go
package loader_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/manimovassagh/portfolio/internal/loader"
)

func TestLoad(t *testing.T) {
	f, err := os.CreateTemp("", "*.csv")
	if err != nil {
		t.Fatal(err)
	}
	defer os.Remove(f.Name())

	f.WriteString(`"datetime","date","account_type","category","type","asset_class","name","symbol","shares","price","amount","fee","tax","currency","original_amount","original_currency","fx_rate","description","transaction_id","counterparty_name","counterparty_iban","payment_reference","mcc_code"
"2025-04-03T11:26:34.643Z","2025-04-03","DEFAULT","TRADING","BUY","FUND","World ETF","IE000TEST01","1.5","100.0","-150.0","-1.0","","EUR","","","","Buy","tx1","","","",""
`)
	f.Close()

	txs, err := loader.Load(f.Name())
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}
	if len(txs) != 1 {
		t.Fatalf("expected 1 tx, got %d", len(txs))
	}
	tx := txs[0]
	if tx.ISIN != "IE000TEST01" {
		t.Errorf("expected ISIN IE000TEST01, got %s", tx.ISIN)
	}
	if tx.Shares != 1.5 {
		t.Errorf("expected shares 1.5, got %f", tx.Shares)
	}
	if tx.Amount != -150.0 {
		t.Errorf("expected amount -150, got %f", tx.Amount)
	}
}

func TestLatestExport(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.csv"), []byte("x"), 0644)
	os.WriteFile(filepath.Join(dir, "b.csv"), []byte("x"), 0644)
	path, err := loader.LatestExport(dir)
	if err != nil {
		t.Fatal(err)
	}
	if path == "" {
		t.Fatal("expected a path, got empty")
	}
}
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd backend && go test ./internal/loader/... 2>&1 | head -5
# Expected: cannot find package or build error
cd ..
```

- [ ] **Step 3: Create `backend/internal/loader/loader.go`**

```go
package loader

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"

	"github.com/manimovassagh/portfolio/internal/model"
)

// LatestExport returns the path to the most recently modified CSV in dir.
func LatestExport(dir string) (string, error) {
	entries, err := filepath.Glob(filepath.Join(dir, "*.csv"))
	if err != nil || len(entries) == 0 {
		return "", fmt.Errorf("no CSV exports found in %s", dir)
	}
	sort.Slice(entries, func(i, j int) bool {
		si, _ := os.Stat(entries[i])
		sj, _ := os.Stat(entries[j])
		return si.ModTime().After(sj.ModTime())
	})
	return entries[0], nil
}

// ListExports returns all CSV paths in dir, newest first.
func ListExports(dir string) []string {
	entries, _ := filepath.Glob(filepath.Join(dir, "*.csv"))
	sort.Slice(entries, func(i, j int) bool {
		si, _ := os.Stat(entries[i])
		sj, _ := os.Stat(entries[j])
		return si.ModTime().After(sj.ModTime())
	})
	return entries
}

// Load reads a Trade Republic CSV export and returns parsed transactions.
func Load(csvPath string) ([]model.Transaction, error) {
	f, err := os.Open(csvPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.LazyQuotes = true
	records, err := r.ReadAll()
	if err != nil {
		return nil, err
	}
	if len(records) < 2 {
		return nil, fmt.Errorf("CSV has no data rows")
	}

	header := records[0]
	idx := make(map[string]int, len(header))
	for i, h := range header {
		idx[h] = i
	}

	col := func(row []string, name string) string {
		i, ok := idx[name]
		if !ok || i >= len(row) {
			return ""
		}
		return row[i]
	}

	parseF := func(s string) float64 {
		v, _ := strconv.ParseFloat(s, 64)
		return v
	}

	var txs []model.Transaction
	for _, row := range records[1:] {
		txs = append(txs, model.Transaction{
			DateTime:    col(row, "datetime"),
			Date:        col(row, "date"),
			Category:    col(row, "category"),
			Type:        col(row, "type"),
			AssetClass:  col(row, "asset_class"),
			Name:        col(row, "name"),
			ISIN:        col(row, "symbol"),
			Shares:      parseF(col(row, "shares")),
			Price:       parseF(col(row, "price")),
			Amount:      parseF(col(row, "amount")),
			Fee:         parseF(col(row, "fee")),
			Tax:         parseF(col(row, "tax")),
			Description: col(row, "description"),
		})
	}
	return txs, nil
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && go test ./internal/loader/... -v
# Expected: PASS
cd ..
```

- [ ] **Step 5: Commit**

```bash
git add backend/internal/loader/
git commit -m "feat(go): csv loader with tests"
```

---

### Task 4: SQLite DB layer (watchlist)

**Files:**
- Create: `backend/internal/db/db.go`
- Create: `backend/internal/db/db_test.go`

- [ ] **Step 1: Create `backend/internal/db/db_test.go`**

```go
package db_test

import (
	"testing"

	"github.com/manimovassagh/portfolio/internal/db"
	"github.com/manimovassagh/portfolio/internal/model"
)

func TestWatchlistCRUD(t *testing.T) {
	store, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	item := model.WatchlistItem{
		ISIN:      "TEST123",
		Ticker:    "TEST",
		Name:      "Test ETF",
		Notes:     "my note",
		AddedDate: "2026-05-21",
	}
	if err := store.AddWatchlistItem(item); err != nil {
		t.Fatalf("add failed: %v", err)
	}

	list, err := store.GetWatchlist()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ISIN != "TEST123" {
		t.Fatalf("expected 1 item with ISIN TEST123, got %+v", list)
	}

	if err := store.RemoveWatchlistItem("TEST123"); err != nil {
		t.Fatalf("remove failed: %v", err)
	}

	list, _ = store.GetWatchlist()
	if len(list) != 0 {
		t.Fatal("expected empty watchlist after remove")
	}
}
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd backend && go test ./internal/db/... 2>&1 | head -5
cd ..
```

- [ ] **Step 3: Create `backend/internal/db/db.go`**

```go
package db

import (
	"database/sql"
	"fmt"

	"github.com/manimovassagh/portfolio/internal/model"
	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() { s.db.Close() }

func (s *Store) migrate() error {
	_, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS watchlist (
		isin         TEXT PRIMARY KEY,
		ticker       TEXT NOT NULL DEFAULT '',
		name         TEXT NOT NULL DEFAULT '',
		notes        TEXT NOT NULL DEFAULT '',
		target_price REAL,
		added_date   TEXT NOT NULL
	)`)
	return err
}

func (s *Store) GetWatchlist() ([]model.WatchlistItem, error) {
	rows, err := s.db.Query(
		`SELECT isin, ticker, name, notes, target_price, added_date FROM watchlist ORDER BY added_date DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.WatchlistItem
	for rows.Next() {
		var item model.WatchlistItem
		if err := rows.Scan(&item.ISIN, &item.Ticker, &item.Name,
			&item.Notes, &item.TargetPrice, &item.AddedDate); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if items == nil {
		items = []model.WatchlistItem{}
	}
	return items, rows.Err()
}

func (s *Store) AddWatchlistItem(item model.WatchlistItem) error {
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO watchlist (isin, ticker, name, notes, target_price, added_date)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		item.ISIN, item.Ticker, item.Name, item.Notes, item.TargetPrice, item.AddedDate)
	return err
}

func (s *Store) RemoveWatchlistItem(isin string) error {
	_, err := s.db.Exec(`DELETE FROM watchlist WHERE isin = ?`, isin)
	return err
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && go test ./internal/db/... -v
cd ..
```

- [ ] **Step 5: Commit**

```bash
git add backend/internal/db/
git commit -m "feat(go): sqlite db layer with watchlist crud"
```

---

### Task 5: Pricer HTTP client

**Files:**
- Create: `backend/internal/pricer/client.go`
- Create: `backend/internal/pricer/client_test.go`

- [ ] **Step 1: Create `backend/internal/pricer/client_test.go`**

```go
package pricer_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/manimovassagh/portfolio/internal/pricer"
)

func TestGetPrices(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/prices" {
			http.NotFound(w, r)
			return
		}
		json.NewEncoder(w).Encode(map[string]float64{
			"IE00BK5BQT80": 159.76,
			"BTC":          66000.0,
		})
	}))
	defer srv.Close()

	client := pricer.New(srv.URL)
	prices, err := client.GetPrices([]string{"IE00BK5BQT80", "BTC"})
	if err != nil {
		t.Fatalf("GetPrices error: %v", err)
	}
	if prices["IE00BK5BQT80"] != 159.76 {
		t.Errorf("expected 159.76, got %f", prices["IE00BK5BQT80"])
	}
	if prices["BTC"] != 66000.0 {
		t.Errorf("expected 66000, got %f", prices["BTC"])
	}
}

func TestGetPrices_PricerDown(t *testing.T) {
	client := pricer.New("http://localhost:19999")
	prices, err := client.GetPrices([]string{"TEST"})
	if err == nil {
		t.Fatal("expected error when pricer is down")
	}
	if prices != nil {
		t.Fatal("expected nil prices on error")
	}
}
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd backend && go test ./internal/pricer/... 2>&1 | head -5
cd ..
```

- [ ] **Step 3: Create `backend/internal/pricer/client.go`**

```go
package pricer

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// GetPrices fetches live prices for the given ISINs from the Python pricer.
// Returns nil and an error if the pricer is unreachable.
func (c *Client) GetPrices(isins []string) (map[string]float64, error) {
	if len(isins) == 0 {
		return map[string]float64{}, nil
	}
	url := fmt.Sprintf("%s/prices?isins=%s", c.baseURL, strings.Join(isins, ","))
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("pricer unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pricer returned %d", resp.StatusCode)
	}

	var prices map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&prices); err != nil {
		return nil, fmt.Errorf("decode pricer response: %w", err)
	}
	return prices, nil
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && go test ./internal/pricer/... -v
cd ..
```

- [ ] **Step 5: Commit**

```bash
git add backend/internal/pricer/
git commit -m "feat(go): pricer http client with tests"
```

---

### Task 6: Holdings service (cost basis, P&L, weights)

**Files:**
- Create: `backend/internal/service/holdings.go`
- Create: `backend/internal/service/holdings_test.go`

- [ ] **Step 1: Create `backend/internal/service/holdings_test.go`**

```go
package service_test

import (
	"testing"

	"github.com/manimovassagh/portfolio/internal/model"
	"github.com/manimovassagh/portfolio/internal/service"
)

func TestComputeHoldings_BuyOnly(t *testing.T) {
	txs := []model.Transaction{
		{Category: "TRADING", Type: "BUY", ISIN: "TEST01", Name: "Test ETF",
			AssetClass: "FUND", Shares: 2.0, Price: 100.0, Amount: -200.0, Fee: -1.0},
	}
	holdings := service.ComputeHoldings(txs)
	h, ok := holdings["TEST01"]
	if !ok {
		t.Fatal("expected holding TEST01")
	}
	if h.Shares != 2.0 {
		t.Errorf("expected shares 2.0, got %f", h.Shares)
	}
	if h.CostBasis != 200.0 {
		t.Errorf("expected cost_basis 200.0, got %f", h.CostBasis)
	}
	if h.AvgCost != 100.0 {
		t.Errorf("expected avg_cost 100.0, got %f", h.AvgCost)
	}
	if h.FeesPaid != 1.0 {
		t.Errorf("expected fees 1.0, got %f", h.FeesPaid)
	}
}

func TestComputeHoldings_BuySell(t *testing.T) {
	txs := []model.Transaction{
		{Category: "TRADING", Type: "BUY", ISIN: "TEST01", Name: "Test ETF",
			AssetClass: "FUND", Shares: 4.0, Price: 100.0, Amount: -400.0},
		{Category: "TRADING", Type: "SELL", ISIN: "TEST01", Name: "Test ETF",
			AssetClass: "FUND", Shares: -2.0, Price: 120.0, Amount: 240.0},
	}
	holdings := service.ComputeHoldings(txs)
	h := holdings["TEST01"]
	if h.Shares != 2.0 {
		t.Errorf("expected 2 shares remaining, got %f", h.Shares)
	}
	if h.CostBasis != 200.0 {
		t.Errorf("expected cost_basis 200 after partial sell, got %f", h.CostBasis)
	}
}

func TestEnrichWithPrices(t *testing.T) {
	holdings := map[string]model.Holding{
		"TEST01": {ISIN: "TEST01", Shares: 2.0, CostBasis: 200.0, AvgCost: 100.0},
	}
	prices := map[string]float64{"TEST01": 120.0}
	enriched := service.EnrichWithPrices(holdings, prices)

	h := enriched[0]
	if h.CurrentPrice == nil || *h.CurrentPrice != 120.0 {
		t.Errorf("expected current_price 120.0")
	}
	if h.MarketValue == nil || *h.MarketValue != 240.0 {
		t.Errorf("expected market_value 240.0")
	}
	if h.UnrealizedPnL == nil || *h.UnrealizedPnL != 40.0 {
		t.Errorf("expected unrealized_pnl 40.0")
	}
	if h.Weight != 100.0 {
		t.Errorf("expected weight 100.0 (only holding), got %f", h.Weight)
	}
}
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd backend && go test ./internal/service/... 2>&1 | head -5
cd ..
```

- [ ] **Step 3: Create `backend/internal/service/holdings.go`**

```go
package service

import (
	"math"
	"sort"
	"strings"

	"github.com/manimovassagh/portfolio/internal/model"
)

var buyTypes = map[string]bool{
	"BUY": true, "SAVINGS_PLAN": true, "ROUND_UP": true, "STOCK_PERK": true,
}
var sellTypes = map[string]bool{
	"SELL": true,
}

// ComputeHoldings walks transactions chronologically and returns current positions.
// Uses average-cost method (German tax standard).
func ComputeHoldings(txs []model.Transaction) map[string]model.Holding {
	holdings := map[string]model.Holding{}

	for _, tx := range txs {
		if strings.ToUpper(tx.Category) != "TRADING" {
			continue
		}
		typ := strings.ToUpper(tx.Type)
		isin := tx.ISIN
		if isin == "" {
			continue
		}

		h := holdings[isin]
		h.ISIN = isin
		h.Name = tx.Name
		h.AssetClass = tx.AssetClass

		shares := math.Abs(tx.Shares)
		fee := math.Abs(tx.Fee)
		h.FeesPaid += fee

		if buyTypes[typ] {
			invested := math.Abs(tx.Amount) - fee
			h.CostBasis += invested
			h.Shares += shares
		} else if sellTypes[typ] {
			if h.Shares > 1e-9 {
				ratio := shares / h.Shares
				h.CostBasis -= h.CostBasis * ratio
			}
			h.Shares -= shares
			if h.Shares < 1e-9 {
				h.Shares = 0
				h.CostBasis = 0
			}
		}

		if h.Shares > 1e-9 {
			h.AvgCost = h.CostBasis / h.Shares
		}
		holdings[isin] = h
	}

	// Remove zero-share positions
	for k, h := range holdings {
		if h.Shares < 1e-9 {
			delete(holdings, k)
		}
	}
	return holdings
}

// EnrichWithPrices attaches live prices, market values, P&L and weights.
func EnrichWithPrices(holdings map[string]model.Holding, prices map[string]float64) []model.Holding {
	totalMV := 0.0
	for isin, h := range holdings {
		if p, ok := prices[isin]; ok {
			mv := p * h.Shares
			totalMV += mv
		}
	}

	result := make([]model.Holding, 0, len(holdings))
	for isin, h := range holdings {
		if p, ok := prices[isin]; ok {
			price := p
			mv := p * h.Shares
			pnl := mv - h.CostBasis
			pnlPct := 0.0
			if h.CostBasis > 0 {
				pnlPct = pnl / h.CostBasis * 100
			}
			h.CurrentPrice = &price
			h.MarketValue = &mv
			h.UnrealizedPnL = &pnl
			h.UnrealizedPct = &pnlPct
			if totalMV > 0 {
				h.Weight = mv / totalMV * 100
			}
		}
		_ = isin
		result = append(result, h)
	}

	sort.Slice(result, func(i, j int) bool {
		mvi := 0.0
		if result[i].MarketValue != nil {
			mvi = *result[i].MarketValue
		}
		mvj := 0.0
		if result[j].MarketValue != nil {
			mvj = *result[j].MarketValue
		}
		return mvi > mvj
	})
	return result
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && go test ./internal/service/... -v
cd ..
```

- [ ] **Step 5: Commit**

```bash
git add backend/internal/service/holdings.go backend/internal/service/holdings_test.go
git commit -m "feat(go): holdings service — cost basis, p&l, weights"
```

---

### Task 7: Holdings handler (GET /api/holdings, GET /api/holdings/:isin)

**Files:**
- Create: `backend/internal/handler/holdings.go`
- Modify: `backend/cmd/api/main.go`

- [ ] **Step 1: Create `backend/internal/handler/holdings.go`**

```go
package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
	"github.com/manimovassagh/portfolio/internal/model"
	"github.com/manimovassagh/portfolio/internal/pricer"
	"github.com/manimovassagh/portfolio/internal/service"
)

type HoldingsHandler struct {
	cfg    config.Config
	pricer *pricer.Client
}

func NewHoldingsHandler(cfg config.Config, p *pricer.Client) *HoldingsHandler {
	return &HoldingsHandler{cfg: cfg, pricer: p}
}

func (h *HoldingsHandler) loadAndEnrich() ([]model.Holding, error) {
	csvPath, err := loader.LatestExport(h.cfg.ExportsDir)
	if err != nil {
		return nil, err
	}
	txs, err := loader.Load(csvPath)
	if err != nil {
		return nil, err
	}
	raw := service.ComputeHoldings(txs)

	isins := make([]string, 0, len(raw))
	for isin := range raw {
		isins = append(isins, isin)
	}
	prices, _ := h.pricer.GetPrices(isins)
	if prices == nil {
		prices = map[string]float64{}
	}
	return service.EnrichWithPrices(raw, prices), nil
}

func (h *HoldingsHandler) List(c *gin.Context) {
	holdings, err := h.loadAndEnrich()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	totalMV := 0.0
	for _, h := range holdings {
		if h.MarketValue != nil {
			totalMV += *h.MarketValue
		}
	}

	var totalMVPtr *float64
	if totalMV > 0 {
		totalMVPtr = &totalMV
	}

	c.JSON(http.StatusOK, gin.H{
		"holdings":           holdings,
		"total_market_value": totalMVPtr,
	})
}

func (h *HoldingsHandler) Detail(c *gin.Context) {
	isin := c.Param("isin")
	csvPath, err := loader.LatestExport(h.cfg.ExportsDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	txs, err := loader.Load(csvPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	raw := service.ComputeHoldings(txs)
	holding, ok := raw[isin]
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	prices, _ := h.pricer.GetPrices([]string{isin})
	if prices == nil {
		prices = map[string]float64{}
	}
	enriched := service.EnrichWithPrices(map[string]model.Holding{isin: holding}, prices)

	var rows []model.TxRow
	for _, tx := range txs {
		if tx.ISIN != isin || tx.Category != "TRADING" {
			continue
		}
		tx := tx
		var shares, price, amount, fee, tax *float64
		if tx.Shares != 0 { shares = &tx.Shares }
		if tx.Price != 0  { price = &tx.Price }
		if tx.Amount != 0 { amount = &tx.Amount }
		if tx.Fee != 0    { fee = &tx.Fee }
		if tx.Tax != 0    { tax = &tx.Tax }
		rows = append(rows, model.TxRow{
			Date: tx.Date, Type: tx.Type,
			Shares: shares, Price: price, Amount: amount,
			Fee: fee, Tax: tax, Description: tx.Description,
		})
	}
	if rows == nil {
		rows = []model.TxRow{}
	}

	c.JSON(http.StatusOK, model.AssetDetail{
		ISIN:         isin,
		Name:         holding.Name,
		AssetClass:   holding.AssetClass,
		Current:      enriched[0],
		Transactions: rows,
	})
}
```

- [ ] **Step 2: Wire handler into `backend/cmd/api/main.go`**

```go
package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/db"
	"github.com/manimovassagh/portfolio/internal/handler"
	"github.com/manimovassagh/portfolio/internal/middleware"
	"github.com/manimovassagh/portfolio/internal/pricer"
)

func main() {
	cfg := config.Load()

	store, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer store.Close()

	pricerClient := pricer.New(cfg.PricerURL)
	holdingsH := handler.NewHoldingsHandler(cfg, pricerClient)

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	api := r.Group("/api")
	api.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	api.GET("/holdings", holdingsH.List)
	api.GET("/holdings/:isin", holdingsH.Detail)

	log.Printf("Go backend on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
```

- [ ] **Step 3: Build and smoke test (pricer must be running)**

```bash
# Terminal 1: start pricer
uv run uvicorn pricer.main:app --port 8001 &

# Terminal 2: start go backend
cd backend && go run ./cmd/api &
sleep 2

curl http://localhost:8766/api/holdings | python3 -m json.tool | head -30
# Expected: JSON with holdings array and total_market_value

pkill -f "uvicorn pricer"; pkill -f "go run"
cd ..
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handler/holdings.go backend/cmd/api/main.go
git commit -m "feat(go): holdings list and detail endpoints"
```

---

### Task 8: Portfolio overview handler (GET /api/portfolio)

**Files:**
- Create: `backend/internal/service/portfolio.go`
- Create: `backend/internal/handler/portfolio.go`
- Modify: `backend/cmd/api/main.go`

- [ ] **Step 1: Create `backend/internal/service/portfolio.go`**

```go
package service

import (
	"github.com/manimovassagh/portfolio/internal/model"
)

// BuildSummary aggregates holdings into a portfolio summary.
func BuildSummary(holdings []model.Holding, txs []model.Transaction) model.PortfolioSummary {
	totalInvested := 0.0
	totalFees := 0.0
	totalTax := 0.0
	totalMV := 0.0
	totalPnL := 0.0

	for _, tx := range txs {
		if tx.Fee < 0 {
			totalFees += -tx.Fee
		}
		if tx.Tax < 0 {
			totalTax += -tx.Tax
		}
	}

	for _, h := range holdings {
		totalInvested += h.CostBasis
		if h.MarketValue != nil {
			totalMV += *h.MarketValue
		}
		if h.UnrealizedPnL != nil {
			totalPnL += *h.UnrealizedPnL
		}
	}

	s := model.PortfolioSummary{
		TotalInvested: totalInvested,
		TotalFees:     totalFees,
		TotalTax:      totalTax,
		Holdings:      holdings,
	}
	if totalMV > 0 {
		s.PortfolioValue = &totalMV
		s.TotalMarketValue = &totalMV
		s.TotalPnL = &totalPnL
		if totalInvested > 0 {
			pct := totalPnL / totalInvested * 100
			s.TotalPnLPct = &pct
		}
	}
	return s
}
```

- [ ] **Step 2: Add `TotalMarketValue` to model — update `backend/internal/model/types.go`**

In `PortfolioSummary`, add the field (it's already there from Task 2 — verify it matches):
```go
TotalMarketValue *float64  `json:"total_market_value"`
```

- [ ] **Step 3: Create `backend/internal/handler/portfolio.go`**

```go
package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
	"github.com/manimovassagh/portfolio/internal/pricer"
	"github.com/manimovassagh/portfolio/internal/service"
)

type PortfolioHandler struct {
	cfg    config.Config
	pricer *pricer.Client
}

func NewPortfolioHandler(cfg config.Config, p *pricer.Client) *PortfolioHandler {
	return &PortfolioHandler{cfg: cfg, pricer: p}
}

func (h *PortfolioHandler) Overview(c *gin.Context) {
	csvPath, err := loader.LatestExport(h.cfg.ExportsDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	txs, err := loader.Load(csvPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	raw := service.ComputeHoldings(txs)
	isins := make([]string, 0, len(raw))
	for isin := range raw {
		isins = append(isins, isin)
	}
	prices, _ := h.pricer.GetPrices(isins)
	if prices == nil {
		prices = map[string]float64{}
	}
	holdings := service.EnrichWithPrices(raw, prices)
	summary := service.BuildSummary(holdings, txs)

	c.JSON(http.StatusOK, summary)
}
```

- [ ] **Step 4: Wire into `main.go`** — add these lines after existing handler wiring:

```go
portfolioH := handler.NewPortfolioHandler(cfg, pricerClient)
// in api group:
api.GET("/portfolio", portfolioH.Overview)
```

- [ ] **Step 5: Smoke test**

```bash
uv run uvicorn pricer.main:app --port 8001 &
cd backend && go run ./cmd/api &
sleep 2
curl http://localhost:8766/api/portfolio | python3 -m json.tool | grep portfolio_value
# Expected: "portfolio_value": 7000+
pkill -f "uvicorn pricer"; pkill -f "go run"
cd ..
```

- [ ] **Step 6: Commit**

```bash
git add backend/internal/service/portfolio.go backend/internal/handler/portfolio.go backend/cmd/api/main.go
git commit -m "feat(go): portfolio overview endpoint"
```

---

### Task 9: Watchlist handler (GET/POST/DELETE /api/watchlist)

**Files:**
- Create: `backend/internal/handler/watchlist.go`
- Modify: `backend/cmd/api/main.go`

- [ ] **Step 1: Create `backend/internal/handler/watchlist.go`**

```go
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
```

- [ ] **Step 2: Wire into `main.go`** — add after portfolio handler wiring:

```go
watchlistH := handler.NewWatchlistHandler(store)
// in api group:
api.GET("/watchlist", watchlistH.Get)
api.POST("/watchlist", watchlistH.Add)
api.DELETE("/watchlist/:isin", watchlistH.Remove)
```

- [ ] **Step 3: Smoke test**

```bash
cd backend && go run ./cmd/api &
sleep 2
curl -X POST http://localhost:8766/api/watchlist \
  -H "Content-Type: application/json" \
  -d '{"isin":"TEST01","ticker":"TEST","name":"Test ETF","notes":"","added_date":"2026-05-21"}'
curl http://localhost:8766/api/watchlist
curl -X DELETE http://localhost:8766/api/watchlist/TEST01
curl http://localhost:8766/api/watchlist
pkill -f "go run"
cd ..
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handler/watchlist.go backend/cmd/api/main.go
git commit -m "feat(go): watchlist crud endpoints"
```

---

### Task 10: Core handler (GET /api/exports, GET /api/health)

**Files:**
- Create: `backend/internal/handler/core.go`
- Modify: `backend/cmd/api/main.go`

- [ ] **Step 1: Create `backend/internal/handler/core.go`**

```go
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
```

- [ ] **Step 2: Wire into `main.go`** — replace the inline health handler:

```go
coreH := handler.NewCoreHandler(cfg)
// in api group:
api.GET("/health", coreH.Health)
api.GET("/exports", coreH.Exports)
```

- [ ] **Step 3: Smoke test**

```bash
cd backend && go run ./cmd/api &
sleep 2
curl http://localhost:8766/api/health
curl http://localhost:8766/api/exports
pkill -f "go run"
cd ..
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/handler/core.go backend/cmd/api/main.go
git commit -m "feat(go): core health and exports endpoints"
```

---

### Task 11: Update root Makefile and docker-compose

**Files:**
- Modify: `Makefile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Update root `Makefile`**

```makefile
.PHONY: run build docker

run:
	@trap 'kill %1 %2' INT; \
	uv run uvicorn pricer.main:app --host 0.0.0.0 --port 8001 & \
	(cd backend && go run ./cmd/api) & \
	npm run dev

build:
	cd backend && go build -o bin/api ./cmd/api
	npm run build

docker:
	docker-compose up --build
```

- [ ] **Step 2: Update `docker-compose.yml`** to add the three services:

```yaml
version: "3.9"
services:
  pricer:
    build:
      context: .
      dockerfile: pricer/Dockerfile
    ports:
      - "8001:8001"
    volumes:
      - ./cache:/app/cache

  api:
    build:
      context: ./backend
    ports:
      - "8766:8766"
    depends_on:
      - pricer
    environment:
      PORT: "8766"
      DB_PATH: "/data/portfolio.db"
      PRICER_URL: "http://pricer:8001"
      EXPORTS_DIR: "/exports"
    volumes:
      - ./portfolio.db:/data/portfolio.db
      - ./exports:/exports

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "8765:8765"
    depends_on:
      - api
```

- [ ] **Step 3: Create `pricer/Dockerfile`**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pricer/ ./pricer/
COPY portfolio/prices.py ./portfolio/prices.py
COPY portfolio/__init__.py ./portfolio/__init__.py
RUN pip install fastapi uvicorn yfinance requests
CMD ["uvicorn", "pricer.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

- [ ] **Step 4: Create `backend/Dockerfile`**

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o bin/api ./cmd/api

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/bin/api .
EXPOSE 8766
CMD ["./api"]
```

- [ ] **Step 5: Commit**

```bash
git add Makefile docker-compose.yml pricer/Dockerfile backend/Dockerfile
git commit -m "feat: update makefile and docker-compose for three-service architecture"
```

---

### Task 12: Remove old Python backend (after all Go routes verified working)

**Files:**
- Delete: `app/` directory
- Delete: `portfolio/` directory (keep `pricer/prices.py` which is the copy)
- Modify: `api.py` (remove — Go serves everything now)
- Modify: `pyproject.toml` (strip to pricer deps only)

- [ ] **Step 1: Verify all Go endpoints match Python equivalents**

```bash
# Start both backends
uv run uvicorn api:app --port 8000 &
uv run uvicorn pricer.main:app --port 8001 &
cd backend && go run ./cmd/api & && cd ..
sleep 3

# Compare holdings counts
python_count=$(curl -s http://localhost:8000/api/holdings | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('holdings',[])))")
go_count=$(curl -s http://localhost:8766/api/holdings | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('holdings',[])))")
echo "Python: $python_count  Go: $go_count"
# Must be equal before proceeding

pkill -f "uvicorn api"; pkill -f "go run"
```

- [ ] **Step 2: Remove old Python backend files**

```bash
rm -rf app/ portfolio/
rm api.py
```

- [ ] **Step 3: Strip pyproject.toml to pricer dependencies only**

Keep only: `fastapi`, `uvicorn`, `yfinance`, `requests`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove python backend — go serves all routes"
```
