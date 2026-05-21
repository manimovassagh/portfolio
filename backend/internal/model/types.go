package model

import "time"

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
	ISIN         string  `json:"isin"`
	Name         string  `json:"name"`
	AssetClass   string  `json:"asset_class"`
	Current      Holding `json:"current"`
	Transactions []TxRow `json:"transactions"`
}

// WatchlistItem is one row from the SQLite watchlist table.
type WatchlistItem struct {
	ISIN         string   `json:"isin"`
	Ticker       string   `json:"ticker"`
	Name         string   `json:"name"`
	Notes        string   `json:"notes"`
	TargetPrice  *float64 `json:"target_price"`
	AddedDate    string   `json:"added_date"`
	CurrentPrice *float64 `json:"current_price"`
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

// SummaryResponse is the /api/summary response matching the frontend's Summary type.
type SummaryResponse struct {
	Export         string   `json:"export"`
	PortfolioValue float64  `json:"portfolio_value"`
	MarketValue    float64  `json:"market_value"`
	CashBalance    float64  `json:"cash_balance"`
	CostBasis      float64  `json:"cost_basis"`
	NetDeposits    float64  `json:"net_deposits"`
	Deposits       float64  `json:"deposits"`
	Withdrawals    float64  `json:"withdrawals"`
	UnrealizedPnL  float64  `json:"unrealized_pnl"`
	UnrealizedPct  float64  `json:"unrealized_pct"`
	RealizedPnL    float64  `json:"realized_pnl"`
	TotalReturn    float64  `json:"total_return"`
	XIRR           *float64 `json:"xirr"`
	Dividends      float64  `json:"dividends"`
	Interest       float64  `json:"interest"`
	StockPerks     float64  `json:"stockperks"`
	Fees           float64  `json:"fees"`
	Tax            float64  `json:"tax"`
	NHoldings      int      `json:"n_holdings"`
	NRealized      int      `json:"n_realized"`
	HolderName     *string  `json:"holder_name"`
	FirstTradeDate *string  `json:"first_trade_date"`
}

// CashSummary holds aggregated cash-flow data from the transaction ledger.
type CashSummary struct {
	Deposits    float64
	Withdrawals float64
	Dividends   float64
	Interest    float64
	StockPerks  float64
	Fees        float64
	Tax         float64
	Invested    float64
	CashBalance float64
}

func (c CashSummary) NetDeposits() float64 { return c.Deposits - c.Withdrawals }

// RealizedEntry is one completed sell trade with P&L.
type RealizedEntry struct {
	Date      *string `json:"date"`
	Name      string  `json:"name"`
	ISIN      string  `json:"isin"`
	Shares    float64 `json:"shares"`
	SellPrice float64 `json:"sell_price"`
	AvgCost   float64 `json:"avg_cost"`
	PnL       float64 `json:"pnl"`
	PnLPct    float64 `json:"pnl_pct"`
}

// IncomeLine is one row in the income log table.
type IncomeLine struct {
	Date   string  `json:"Date"`
	Type   string  `json:"Type"`
	Asset  string  `json:"Asset"`
	Amount float64 `json:"Amount (EUR)"`
	Tax    float64 `json:"Tax (EUR)"`
}

// TaxLine is one row in the tax view table.
type TaxLine struct {
	Date        string  `json:"Date"`
	Type        string  `json:"Type"`
	Asset       string  `json:"Asset"`
	Amount      float64 `json:"Amount (EUR)"`
	Tax         float64 `json:"Tax (EUR)"`
	Description string  `json:"Description"`
}

// AssetCurrentInfo is the "current" block for /api/asset/:isin (uses "unrealized" key).
type AssetCurrentInfo struct {
	Shares       float64  `json:"shares"`
	AvgCost      float64  `json:"avg_cost"`
	CostBasis    float64  `json:"cost_basis"`
	CurrentPrice *float64 `json:"current_price"`
	MarketValue  *float64 `json:"market_value"`
	Unrealized   *float64 `json:"unrealized"`
}

// AssetDetailV2 is the response for /api/asset/:isin matching the frontend AssetDetail type.
type AssetDetailV2 struct {
	ISIN         string           `json:"isin"`
	Name         string           `json:"name"`
	AssetClass   string           `json:"asset_class"`
	Transactions []TxRow          `json:"transactions"`
	Current      AssetCurrentInfo `json:"current"`
}

// SectorItem is one entry in the analytics sectors list.
type SectorItem struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

// User is an authenticated account owner.
type User struct {
	ID              string `json:"id"`
	Provider        string `json:"provider"`
	ProviderSubject string `json:"-"`
	Email           string `json:"email"`
	Name            string `json:"name"`
	CreatedAt       string `json:"created_at"`
}

// Session is one browser session bound to a user.
type Session struct {
	Token     string
	UserID    string
	ExpiresAt time.Time
}

// AuthSession is the public auth state returned to the frontend.
type AuthSession struct {
	Authenticated bool  `json:"authenticated"`
	Required      bool  `json:"required"`
	User          *User `json:"user"`
}
