package loader

import (
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

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

// LoadExport loads transactions for a named export, or all exports merged when name is "all".
func LoadExport(dir, name string) ([]model.Transaction, error) {
	if name == "all" {
		return LoadAll(dir)
	}
	p, err := ResolveExport(dir, name)
	if err != nil {
		return nil, err
	}
	return Load(p)
}

// LoadAll loads and concatenates transactions from every CSV in dir.
func LoadAll(dir string) ([]model.Transaction, error) {
	paths := ListExports(dir)
	if len(paths) == 0 {
		return nil, fmt.Errorf("no CSV exports found in %s", dir)
	}
	var all []model.Transaction
	for _, p := range paths {
		txs, err := Load(p)
		if err != nil {
			return nil, fmt.Errorf("loading %s: %w", filepath.Base(p), err)
		}
		all = append(all, txs...)
	}
	return all, nil
}

// Load reads a Trade Republic CSV export and returns parsed transactions.
func Load(csvPath string) ([]model.Transaction, error) {
	f, err := os.Open(csvPath)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()

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

	parseF := func(s string) (float64, error) {
		if s == "" {
			return 0, nil
		}
		v, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return 0, fmt.Errorf("cannot parse %q as number", s)
		}
		return v, nil
	}

	var txs []model.Transaction
	var errs []string
	for i, row := range records[1:] {
		rowNum := i + 2 // 1-based, row 1 is the header

		parseCol := func(colName string) float64 {
			v, err := parseF(col(row, colName))
			if err != nil {
				errs = append(errs, fmt.Sprintf("row %d, column %q: %s", rowNum, colName, err))
			}
			return v
		}

		txs = append(txs, model.Transaction{
			DateTime:    col(row, "datetime"),
			Date:        col(row, "date"),
			Category:    col(row, "category"),
			Type:        col(row, "type"),
			AssetClass:  col(row, "asset_class"),
			Name:        col(row, "name"),
			ISIN:        col(row, "symbol"),
			Shares:      parseCol("shares"),
			Price:       parseCol("price"),
			Amount:      parseCol("amount"),
			Fee:         parseCol("fee"),
			Tax:         parseCol("tax"),
			Description: col(row, "description"),
		})
	}
	if len(errs) > 0 {
		return nil, fmt.Errorf("CSV validation errors:\n  %s", strings.Join(errs, "\n  "))
	}
	return txs, nil
}
