package pricer

import (
	"bytes"
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

// Health probes the pricer's /health endpoint.
func (c *Client) Health() error {
	resp, err := c.httpClient.Get(c.baseURL + "/health")
	if err != nil {
		return fmt.Errorf("pricer unreachable: %w", err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("pricer returned %d", resp.StatusCode)
	}
	return nil
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
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pricer returned %d", resp.StatusCode)
	}

	var prices map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&prices); err != nil {
		return nil, fmt.Errorf("decode pricer response: %w", err)
	}
	return prices, nil
}

// AnalyticsTx is one transaction row sent to the pricer for time-series analytics.
type AnalyticsTx struct {
	Date   string  `json:"date"`
	ISIN   string  `json:"isin"`
	Shares float64 `json:"shares"`
	Amount float64 `json:"amount"`
	Type   string  `json:"type"`
}

// PortfolioAnalyticsResult is the response from POST /portfolio_analytics.
type PortfolioAnalyticsResult struct {
	Monthly    map[string]map[string]float64 `json:"monthly"`
	Annual     []AnnualEntry                 `json:"annual"`
	Sharpe     *float64                      `json:"sharpe"`
	Volatility *float64                      `json:"volatility"`
	MaxDDDays  int                           `json:"max_dd_days"`
	PnLSeries  []PnLPoint                    `json:"pnl_series"`
}

// AnnualEntry is one year's P&L figure.
type AnnualEntry struct {
	Year int     `json:"year"`
	PnL  float64 `json:"pnl"`
	Pct  float64 `json:"pct"`
}

// PnLPoint is one date/value pair in the unrealised P&L time series.
type PnLPoint struct {
	Date string  `json:"date"`
	PnL  float64 `json:"pnl"`
}

// slowClient is used for endpoints that trigger yfinance historical downloads.
var slowClient = &http.Client{Timeout: 90 * time.Second}

func (c *Client) postJSON(path string, payload any, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	resp, err := slowClient.Post(c.baseURL+path, "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("pricer %s unreachable: %w", path, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("pricer %s returned %d", path, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// PostPortfolioAnalytics sends transactions to the pricer and returns analytics metrics.
func (c *Client) PostPortfolioAnalytics(txs []AnalyticsTx) (*PortfolioAnalyticsResult, error) {
	var result PortfolioAnalyticsResult
	if err := c.postJSON("/portfolio_analytics", map[string]any{"transactions": txs}, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// PerformanceSeries is the response from POST /portfolio_performance.
type PerformanceSeries struct {
	Series    []PerfPoint `json:"series"`
	Drawdown  []DDPoint   `json:"drawdown"`
	TWR       []TWRPoint  `json:"twr"`
	Benchmark []TWRPoint  `json:"benchmark"`
}

// PerfPoint is one day in the portfolio value time series.
type PerfPoint struct {
	Date           string  `json:"date"`
	PortfolioValue float64 `json:"portfolio_value"`
	Contributions  float64 `json:"contributions"`
	HoldingsValue  float64 `json:"holdings_value"`
}

// DDPoint is one day in the drawdown series.
type DDPoint struct {
	Date     string  `json:"date"`
	Drawdown float64 `json:"drawdown"`
}

// TWRPoint is one day in the cumulative TWR series.
type TWRPoint struct {
	Date string  `json:"date"`
	TWR  float64 `json:"twr"`
}

// PostPortfolioPerformance returns the daily portfolio time series for the hero chart.
// benchmark is an optional yfinance ticker (e.g. "URTH", "CSPX.L"); empty string means use the pricer default.
func (c *Client) PostPortfolioPerformance(txs []AnalyticsTx, benchmark string) (*PerformanceSeries, error) {
	payload := map[string]any{"transactions": txs}
	if benchmark != "" {
		payload["benchmark"] = benchmark
	}
	var result PerformanceSeries
	if err := c.postJSON("/portfolio_performance", payload, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
