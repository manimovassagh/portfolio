package handler

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/model"
)

func TestListUserExportsDoesNotSeedSampleForSignedInUsers(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{ExportsDir: dir}

	names, err := listUserExports(cfg, "user-123")
	if err != nil {
		t.Fatalf("listUserExports failed: %v", err)
	}
	if len(names) != 0 {
		t.Fatalf("expected no seeded exports for signed-in user, got %v", names)
	}

	userDir := userScopeDir(cfg, "user-123")
	if err := os.MkdirAll(userDir, 0o755); err != nil {
		t.Fatalf("mkdir user dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(userDir, "imported.csv"), []byte("Date,Type\n"), 0o644); err != nil {
		t.Fatalf("write export: %v", err)
	}

	names, err = listUserExports(cfg, "user-123")
	if err != nil {
		t.Fatalf("listUserExports after upload failed: %v", err)
	}
	if len(names) != 1 || names[0] != "imported.csv" {
		t.Fatalf("expected uploaded export only, got %v", names)
	}
}

func TestListUserExportsStillExposesGuestSample(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{ExportsDir: dir}

	names, err := listUserExports(cfg, "")
	if err != nil {
		t.Fatalf("listUserExports failed: %v", err)
	}
	if len(names) != 1 || names[0] != guestExportName {
		t.Fatalf("expected guest sample export, got %v", names)
	}
}

func TestBuildExportInfoUsesHolderAndDateForLabel(t *testing.T) {
	cfg := config.Config{ExportsDir: t.TempDir()}
	txs := []model.Transaction{
		{Date: "2026-03-10", Type: "TRANSFER_INBOUND", Description: "Cash transfer from Max Musterman"},
		{Date: "2026-04-12", Category: "TRADING", Type: "BUY", Name: "Apple", ISIN: "US0378331005"},
	}

	info := buildExportInfo(cfg, "user-123", "Transaction export 7.csv", txs)

	if info["label"] != "Max Musterman · Trade Republic · 2026-04" {
		t.Fatalf("unexpected label: %v", info["label"])
	}
	if info["holder_name"] == nil || *(info["holder_name"].(*string)) != "Max Musterman" {
		t.Fatalf("unexpected holder: %v", info["holder_name"])
	}
	if info["transaction_count"] != 2 {
		t.Fatalf("unexpected transaction count: %v", info["transaction_count"])
	}
}
