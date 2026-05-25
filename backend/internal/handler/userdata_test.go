package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
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

func TestLoadSampleExportCopiesSeedIntoUserScope(t *testing.T) {
	dir := t.TempDir()
	seed := filepath.Join(dir, "seed.csv")
	t.Setenv("SEED_EXPORT_PATH", seed)
	if err := os.WriteFile(seed, []byte("Date,Type,Description\n2026-01-01,TRANSFER_INBOUND,Cash transfer from Max Musterman\n"), 0o644); err != nil {
		t.Fatalf("write seed: %v", err)
	}

	gin.SetMode(gin.TestMode)
	cfg := config.Config{ExportsDir: dir}
	h := NewMiscHandler(cfg, nil)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "auth0|user-123")
		c.Next()
	})
	r.POST("/sample_export", h.LoadSampleExport)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/sample_export", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if _, err := os.Stat(filepath.Join(userScopeDir(cfg, "auth0|user-123"), guestExportName)); err != nil {
		t.Fatalf("sample was not copied: %v", err)
	}
	var payload struct {
		Filename string   `json:"filename"`
		Exports  []string `json:"exports"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Filename != guestExportName || len(payload.Exports) != 1 || payload.Exports[0] != guestExportName {
		t.Fatalf("unexpected response: %+v", payload)
	}
}
