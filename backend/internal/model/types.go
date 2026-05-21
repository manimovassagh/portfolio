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
