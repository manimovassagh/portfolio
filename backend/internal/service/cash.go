package service

import (
	"math"
	"strings"
	"time"

	"github.com/manimovassagh/portfolio/internal/model"
)

var depositTypes = map[string]bool{
	"TRANSFER_INBOUND": true, "TRANSFER_INSTANT_INBOUND": true, "CUSTOMER_INPAYMENT": true,
}
var withdrawalTypes = map[string]bool{
	"TRANSFER_OUTBOUND": true, "TRANSFER_INSTANT_OUTBOUND": true,
}
var incomeTypes = map[string]bool{
	"DIVIDEND": true, "INTEREST_PAYMENT": true, "STOCKPERK": true,
}

// ComputeCash aggregates cash-flow totals from the full transaction ledger.
func ComputeCash(txs []model.Transaction) model.CashSummary {
	var cs model.CashSummary
	for _, tx := range txs {
		typ := strings.ToUpper(tx.Type)
		if depositTypes[typ] {
			cs.Deposits += tx.Amount
		} else if withdrawalTypes[typ] {
			cs.Withdrawals -= tx.Amount // TR stores withdrawal amounts as negative
		}
		switch typ {
		case "DIVIDEND":
			cs.Dividends += tx.Amount
		case "INTEREST_PAYMENT":
			cs.Interest += tx.Amount
		case "STOCKPERK":
			cs.StockPerks += tx.Amount
		}
		cs.Fees += -tx.Fee  // fee stored negative in TR exports
		cs.Tax += -tx.Tax   // tax stored negative in TR exports
		cs.CashBalance += tx.Amount + tx.Fee + tx.Tax
		if strings.ToUpper(tx.Category) == "TRADING" {
			cs.Invested += -tx.Amount
		}
	}
	return cs
}

// HolderName extracts the account holder's name from deposit descriptions.
func HolderName(txs []model.Transaction) *string {
	for _, tx := range txs {
		if !depositTypes[strings.ToUpper(tx.Type)] {
			continue
		}
		desc := strings.ToLower(tx.Description)
		if !strings.Contains(desc, "from ") {
			continue
		}
		parts := strings.SplitN(tx.Description, "from ", 2)
		if len(parts) != 2 || strings.TrimSpace(parts[1]) == "" {
			continue
		}
		name := strings.TrimSpace(parts[1])
		for _, sep := range []string{" und ", " and ", " & "} {
			if idx := strings.Index(name, sep); idx >= 0 {
				name = strings.TrimSpace(name[:idx])
				break
			}
		}
		s := name
		return &s
	}
	return nil
}

// FirstTradeDate returns the earliest TRADING transaction date as "YYYY-MM-DD".
func FirstTradeDate(txs []model.Transaction) *string {
	var earliest string
	for _, tx := range txs {
		if strings.ToUpper(tx.Category) != "TRADING" || tx.Date == "" {
			continue
		}
		if earliest == "" || tx.Date < earliest {
			earliest = tx.Date
		}
	}
	if earliest == "" {
		return nil
	}
	return &earliest
}

// IncomeLog returns income transactions sorted newest-first.
func IncomeLog(txs []model.Transaction) []model.IncomeLine {
	var rows []model.IncomeLine
	for _, tx := range txs {
		if !incomeTypes[strings.ToUpper(tx.Type)] {
			continue
		}
		asset := tx.Name
		if asset == "" {
			asset = "—"
		}
		rows = append(rows, model.IncomeLine{
			Date:   tx.Date,
			Type:   tx.Type,
			Asset:  asset,
			Amount: tx.Amount,
			Tax:    -tx.Tax,
		})
	}
	// sort descending by date (lexicographic is fine for YYYY-MM-DD)
	for i := 0; i < len(rows); i++ {
		for j := i + 1; j < len(rows); j++ {
			if rows[j].Date > rows[i].Date {
				rows[i], rows[j] = rows[j], rows[i]
			}
		}
	}
	return rows
}

// TaxLog returns tax-relevant rows sorted newest-first.
func TaxLog(txs []model.Transaction) []model.TaxLine {
	var rows []model.TaxLine
	for _, tx := range txs {
		hasTax := math.Abs(tx.Tax) > 1e-9
		isEarnings := strings.ToUpper(tx.Type) == "EARNINGS"
		if !hasTax && !isEarnings {
			continue
		}
		asset := tx.Name
		if asset == "" {
			asset = "—"
		}
		rows = append(rows, model.TaxLine{
			Date:        tx.Date,
			Type:        tx.Type,
			Asset:       asset,
			Amount:      tx.Amount,
			Tax:         -tx.Tax,
			Description: tx.Description,
		})
	}
	for i := 0; i < len(rows); i++ {
		for j := i + 1; j < len(rows); j++ {
			if rows[j].Date > rows[i].Date {
				rows[i], rows[j] = rows[j], rows[i]
			}
		}
	}
	return rows
}

// CashBalancePoint is one daily balance entry.
type CashBalancePoint struct {
	Date string  `json:"date"`
	Cash float64 `json:"cash"`
}

// CashBalanceOverTime returns cumulative daily cash balance from transactions.
func CashBalanceOverTime(txs []model.Transaction) []CashBalancePoint {
	daily := map[string]float64{}
	for _, tx := range txs {
		d := tx.Date
		if d == "" {
			continue
		}
		daily[d] += tx.Amount + tx.Fee + tx.Tax
	}
	// collect and sort dates
	dates := make([]string, 0, len(daily))
	for d := range daily {
		dates = append(dates, d)
	}
	for i := 0; i < len(dates); i++ {
		for j := i + 1; j < len(dates); j++ {
			if dates[j] < dates[i] {
				dates[i], dates[j] = dates[j], dates[i]
			}
		}
	}
	var points []CashBalancePoint
	var cum float64
	for _, d := range dates {
		cum += daily[d]
		points = append(points, CashBalancePoint{Date: d, Cash: cum})
	}
	return points
}

// cashFlow holds (date, amount) for XIRR computation.
type cashFlow struct {
	Date   time.Time
	Amount float64
}

// XIRR computes the annualized internal rate of return for irregular cash flows.
// Outflows (deposits) are negative; the final entry is the current portfolio value (positive).
func XIRR(txs []model.Transaction, portValue float64) *float64 {
	var flows []cashFlow
	for _, tx := range txs {
		typ := strings.ToUpper(tx.Type)
		if !depositTypes[typ] && !withdrawalTypes[typ] {
			continue
		}
		t, err := time.Parse("2006-01-02", tx.Date)
		if err != nil {
			continue
		}
		// Deposits are outflows (investor pays out money), withdrawals are inflows.
		flows = append(flows, cashFlow{Date: t, Amount: -tx.Amount})
	}
	flows = append(flows, cashFlow{Date: time.Now(), Amount: portValue})

	if len(flows) < 2 {
		return nil
	}
	allNeg, allPos := true, true
	for _, f := range flows {
		if f.Amount > 0 {
			allNeg = false
		}
		if f.Amount < 0 {
			allPos = false
		}
	}
	if allNeg || allPos {
		return nil
	}

	t0 := flows[0].Date
	npv := func(rate float64) float64 {
		sum := 0.0
		for _, f := range flows {
			days := f.Date.Sub(t0).Hours() / 24.0
			denom := math.Pow(1+rate, days/365.0)
			if denom == 0 {
				return math.MaxFloat64
			}
			sum += f.Amount / denom
		}
		return sum
	}

	// Bisection over [-0.999, 100]
	a, b := -0.999, 100.0
	fa, fb := npv(a), npv(b)
	if fa*fb > 0 {
		return nil
	}
	for i := 0; i < 200; i++ {
		c := (a + b) / 2
		fc := npv(c)
		if math.Abs(fc) < 1e-7 || math.Abs(b-a) < 1e-10 {
			result := c
			return &result
		}
		if fa*fc < 0 {
			b, fb = c, fc
		} else {
			a, fa = c, fc
		}
	}
	return nil
}
