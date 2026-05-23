package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/pricer"
)

const wsPriceInterval = 30 * time.Second

var wsUpgrader = websocket.Upgrader{
	HandshakeTimeout: 10 * time.Second,
	CheckOrigin:      func(*http.Request) bool { return true },
}

type PricesWSHandler struct {
	cfg    config.Config
	pricer *pricer.Client
}

func NewPricesWSHandler(cfg config.Config, p *pricer.Client) *PricesWSHandler {
	return &PricesWSHandler{cfg: cfg, pricer: p}
}

// Stream upgrades to WebSocket and pushes live price patches every 30 s.
// Query params:
//   - ?export=<name>  — derive ISINs from this CSV export
//   - ?isins=A,B,...  — explicit comma-separated ISIN list (overrides export)
func (h *PricesWSHandler) Stream(c *gin.Context) {
	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer func() { _ = conn.Close() }()

	isins := h.resolveISINs(c)
	if len(isins) == 0 {
		_ = conn.WriteJSON(map[string]any{"type": "error", "message": "no ISINs to track"})
		return
	}

	// Pump loop: send immediately, then on timer.
	tick := time.NewTicker(wsPriceInterval)
	defer tick.Stop()

	send := func() bool {
		prices, err := h.pricer.GetPrices(isins)
		if err != nil {
			// Skip this tick on pricer errors; don't kill the connection.
			return true
		}
		msg, _ := json.Marshal(map[string]any{"type": "prices", "data": prices})
		if wErr := conn.WriteMessage(websocket.TextMessage, msg); wErr != nil {
			return false
		}
		return true
	}

	if !send() {
		return
	}

	// Background goroutine reads client frames so gorilla detects disconnects.
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()

	for {
		select {
		case <-done:
			return
		case <-tick.C:
			if !send() {
				return
			}
		}
	}
}

func (h *PricesWSHandler) resolveISINs(c *gin.Context) []string {
	if raw := c.Query("isins"); raw != "" {
		parts := strings.Split(raw, ",")
		out := make([]string, 0, len(parts))
		for _, p := range parts {
			if s := strings.TrimSpace(strings.ToUpper(p)); isinRE.MatchString(s) {
				out = append(out, s)
			}
		}
		return out
	}

	txs, err := loadUserExport(h.cfg, currentUserID(c), c.Query("export"))
	if err != nil {
		log.Printf("ws/prices: export not found: %v", err)
		return nil
	}

	seen := map[string]struct{}{}
	var isins []string
	for _, tx := range txs {
		if tx.ISIN != "" && tx.Category == "TRADING" {
			if _, ok := seen[tx.ISIN]; !ok {
				seen[tx.ISIN] = struct{}{}
				isins = append(isins, tx.ISIN)
			}
		}
	}
	return isins
}
