package handler

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
	"github.com/manimovassagh/portfolio/internal/model"
)

const guestExportName = "sample-portfolio.csv"

func currentUserID(c *gin.Context) string {
	if v, ok := c.Get("user_id"); ok {
		if id, ok := v.(string); ok {
			return id
		}
	}
	return ""
}

func userScopeDir(cfg config.Config, userID string) string {
	return filepath.Join(cfg.ExportsDir, sanitizeScope(userID))
}

func sanitizeScope(value string) string {
	replacer := strings.NewReplacer(":", "_", "/", "_", "\\", "_", " ", "_")
	return replacer.Replace(value)
}

func ensureSeedExport(cfg config.Config, userID string) error {
	dir := userScopeDir(cfg, userID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if paths, err := filepath.Glob(filepath.Join(dir, "*.csv")); err == nil && len(paths) > 0 {
		return nil
	}

	seedPath, err := findSeedExportPath()
	if err != nil {
		return nil
	}
	data, err := os.ReadFile(seedPath)
	if err != nil {
		return fmt.Errorf("read seed export: %w", err)
	}
	dest := filepath.Join(dir, filepath.Base(seedPath))
	return os.WriteFile(dest, data, 0o644)
}

func findSeedExportPath() (string, error) {
	candidates := []string{
		os.Getenv("SEED_EXPORT_PATH"),
		"../exports/sample-portfolio.csv",
		"./exports/sample-portfolio.csv",
		"/app/exports/sample-portfolio.csv",
	}
	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}
		if _, err := os.Stat(candidate); err == nil {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("seed export not found")
}

func copyFile(dst string, src io.Reader) error {
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer func() { _ = out.Close() }()
	_, err = io.Copy(out, src)
	return err
}

func listUserExports(cfg config.Config, userID string) ([]string, error) {
	if userID == "" {
		return []string{guestExportName}, nil
	}
	if err := ensureSeedExport(cfg, userID); err != nil {
		return nil, err
	}
	paths, err := filepath.Glob(filepath.Join(userScopeDir(cfg, userID), "*.csv"))
	if err != nil {
		return nil, err
	}
	sort.Slice(paths, func(i, j int) bool {
		si, _ := os.Stat(paths[i])
		sj, _ := os.Stat(paths[j])
		return si.ModTime().After(sj.ModTime())
	})
	names := make([]string, len(paths))
	for i, p := range paths {
		names[i] = filepath.Base(p)
	}
	return names, nil
}

func loadUserExport(cfg config.Config, userID, name string) ([]model.Transaction, error) {
	if userID == "" {
		return loadGuestExport(name)
	}
	if err := ensureSeedExport(cfg, userID); err != nil {
		return nil, err
	}
	return loader.LoadExport(userScopeDir(cfg, userID), name)
}

func loadGuestExport(name string) ([]model.Transaction, error) {
	if name == "" || name == "all" || filepath.Base(name) == guestExportName {
		seedPath, err := findSeedExportPath()
		if err != nil {
			return nil, err
		}
		return loader.Load(seedPath)
	}
	return nil, fmt.Errorf("sign in required")
}
