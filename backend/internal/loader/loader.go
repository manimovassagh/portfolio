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

// ResolveExport returns the path for a named export, or the latest if name is empty.
func ResolveExport(dir, name string) (string, error) {
	if name == "" {
		return LatestExport(dir)
	}
	p := filepath.Join(dir, filepath.Base(name))
	if _, err := os.Stat(p); os.IsNotExist(err) {
		return "", fmt.Errorf("export %q not found", name)
	}
	return p, nil
}

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
