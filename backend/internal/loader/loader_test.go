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
