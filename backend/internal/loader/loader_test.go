package loader_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/manimovassagh/portfolio/internal/loader"
)

// writeCSV writes content to a temp file and returns its path.
// The caller is responsible for removing the file.
func writeCSV(t *testing.T, content string) string {
	t.Helper()
	f, err := os.CreateTemp("", "*.csv")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.WriteString(content); err != nil {
		t.Fatal(err)
	}
	f.Close()
	return f.Name()
}

const csvHeader = "datetime,date,category,type,asset_class,name,symbol,shares,price,amount,fee,tax,description\n"

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

// TestLoad_ValidCSV checks that a well-formed CSV parses without error.
func TestLoad_ValidCSV(t *testing.T) {
	content := csvHeader +
		"2024-01-15T10:00:00,2024-01-15,Purchase,Buy,Equity,iShares MSCI World,IE00B4L5Y983,10,80.50,805.00,0.99,0.00,\n"
	path := writeCSV(t, content)
	defer os.Remove(path)

	txs, err := loader.Load(path)
	if err != nil {
		t.Fatalf("expected no error for valid CSV, got: %v", err)
	}
	if len(txs) != 1 {
		t.Fatalf("expected 1 transaction, got %d", len(txs))
	}
	tx := txs[0]
	if tx.Shares != 10 {
		t.Errorf("expected shares=10, got %f", tx.Shares)
	}
	if tx.Price != 80.50 {
		t.Errorf("expected price=80.50, got %f", tx.Price)
	}
	if tx.Amount != 805.00 {
		t.Errorf("expected amount=805.00, got %f", tx.Amount)
	}
	if tx.Fee != 0.99 {
		t.Errorf("expected fee=0.99, got %f", tx.Fee)
	}
	if tx.Tax != 0.00 {
		t.Errorf("expected tax=0.00, got %f", tx.Tax)
	}
}

// TestLoad_EmptyNumericField checks that an empty shares cell is treated as 0, no error.
func TestLoad_EmptyNumericField(t *testing.T) {
	// shares column is empty
	content := csvHeader +
		"2024-01-15T10:00:00,2024-01-15,Purchase,Buy,Equity,iShares MSCI World,IE00B4L5Y983,,80.50,805.00,0.99,0.00,\n"
	path := writeCSV(t, content)
	defer os.Remove(path)

	txs, err := loader.Load(path)
	if err != nil {
		t.Fatalf("expected no error for empty numeric field, got: %v", err)
	}
	if len(txs) != 1 {
		t.Fatalf("expected 1 transaction, got %d", len(txs))
	}
	if txs[0].Shares != 0 {
		t.Errorf("expected shares=0 for empty field, got %f", txs[0].Shares)
	}
}

// TestLoad_MalformedNumericField checks that a bad value in shares causes an error
// mentioning the correct row number and column name.
func TestLoad_MalformedNumericField(t *testing.T) {
	// shares column contains "abc"
	content := csvHeader +
		"2024-01-15T10:00:00,2024-01-15,Purchase,Buy,Equity,iShares MSCI World,IE00B4L5Y983,abc,80.50,805.00,0.99,0.00,\n"
	path := writeCSV(t, content)
	defer os.Remove(path)

	txs, err := loader.Load(path)
	if txs != nil {
		t.Errorf("expected nil transactions on error, got %d", len(txs))
	}
	if err == nil {
		t.Fatal("expected an error for malformed numeric field, got nil")
	}
	msg := err.Error()
	if !strings.Contains(msg, "row 2") {
		t.Errorf("error should mention row 2, got: %s", msg)
	}
	if !strings.Contains(msg, `"shares"`) {
		t.Errorf(`error should mention column "shares", got: %s`, msg)
	}
	if !strings.Contains(msg, "abc") {
		t.Errorf("error should mention the bad value 'abc', got: %s", msg)
	}
}

// TestLoad_MultipleErrors checks that all validation failures across rows are collected.
func TestLoad_MultipleErrors(t *testing.T) {
	// Row 2: bad shares; Row 3: bad amount
	content := csvHeader +
		"2024-01-15T10:00:00,2024-01-15,Purchase,Buy,Equity,iShares MSCI World,IE00B4L5Y983,abc,80.50,805.00,0.99,0.00,\n" +
		"2024-02-01T09:00:00,2024-02-01,Purchase,Buy,Equity,iShares MSCI World,IE00B4L5Y983,5,80.50,N/A,0.99,0.00,\n"
	path := writeCSV(t, content)
	defer os.Remove(path)

	txs, err := loader.Load(path)
	if txs != nil {
		t.Errorf("expected nil transactions on error, got %d", len(txs))
	}
	if err == nil {
		t.Fatal("expected an error for multiple malformed fields, got nil")
	}
	msg := err.Error()
	if !strings.Contains(msg, "row 2") {
		t.Errorf("error should mention row 2, got: %s", msg)
	}
	if !strings.Contains(msg, "row 3") {
		t.Errorf("error should mention row 3, got: %s", msg)
	}
	if !strings.Contains(msg, "abc") {
		t.Errorf("error should mention bad value 'abc', got: %s", msg)
	}
	if !strings.Contains(msg, "N/A") {
		t.Errorf("error should mention bad value 'N/A', got: %s", msg)
	}
}
