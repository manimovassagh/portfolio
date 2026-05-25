package handler

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/loader"
	"github.com/manimovassagh/portfolio/internal/model"
	"github.com/manimovassagh/portfolio/internal/service"
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
	dir := userScopeDir(cfg, userID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	paths, err := filepath.Glob(filepath.Join(dir, "*.csv"))
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

func listUserExportInfos(cfg config.Config, userID string, names []string) []gin.H {
	infos := make([]gin.H, 0, len(names))
	for _, name := range names {
		txs, err := loadUserExport(cfg, userID, name)
		if err != nil {
			infos = append(infos, fallbackExportInfo(cfg, userID, name))
			continue
		}
		infos = append(infos, buildExportInfo(cfg, userID, name, txs))
	}
	return infos
}

func buildExportInfo(cfg config.Config, userID, name string, txs []model.Transaction) gin.H {
	var firstDate, lastDate *string
	for _, tx := range txs {
		if tx.Date == "" {
			continue
		}
		if firstDate == nil || tx.Date < *firstDate {
			date := tx.Date
			firstDate = &date
		}
		if lastDate == nil || tx.Date > *lastDate {
			date := tx.Date
			lastDate = &date
		}
	}
	holder := service.HolderName(txs)
	broker := "Trade Republic"
	label := exportDisplayLabel(name, holder, &broker, lastDate)
	return gin.H{
		"name":              name,
		"label":             label,
		"holder_name":       holder,
		"broker":            broker,
		"imported_at":       exportModTime(cfg, userID, name),
		"first_date":        firstDate,
		"last_date":         lastDate,
		"transaction_count": len(txs),
	}
}

func fallbackExportInfo(cfg config.Config, userID, name string) gin.H {
	return gin.H{
		"name":              name,
		"label":             strings.TrimSuffix(name, filepath.Ext(name)),
		"holder_name":       nil,
		"broker":            nil,
		"imported_at":       exportModTime(cfg, userID, name),
		"first_date":        nil,
		"last_date":         nil,
		"transaction_count": 0,
	}
}

func exportDisplayLabel(name string, holder, broker, lastDate *string) string {
	parts := []string{}
	if holder != nil && strings.TrimSpace(*holder) != "" {
		parts = append(parts, strings.TrimSpace(*holder))
	}
	if broker != nil && strings.TrimSpace(*broker) != "" {
		parts = append(parts, strings.TrimSpace(*broker))
	}
	if lastDate != nil && len(*lastDate) >= 7 {
		parts = append(parts, (*lastDate)[:7])
	}
	if len(parts) > 0 {
		return strings.Join(parts, " · ")
	}
	return strings.TrimSuffix(name, filepath.Ext(name))
}

func exportModTime(cfg config.Config, userID, name string) *string {
	var path string
	if userID == "" {
		seedPath, err := findSeedExportPath()
		if err != nil {
			return nil
		}
		path = seedPath
	} else {
		path = filepath.Join(userScopeDir(cfg, userID), filepath.Base(name))
	}
	stat, err := os.Stat(path)
	if err != nil {
		return nil
	}
	value := stat.ModTime().UTC().Format(time.RFC3339)
	return &value
}

func loadUserExport(cfg config.Config, userID, name string) ([]model.Transaction, error) {
	if userID == "" {
		return loadGuestExport(name)
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
