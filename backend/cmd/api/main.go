package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/db"
	"github.com/manimovassagh/portfolio/internal/handler"
	"github.com/manimovassagh/portfolio/internal/middleware"
	"github.com/manimovassagh/portfolio/internal/pricer"
)

func main() {
	cfg := config.Load()

	store, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer store.Close()

	pricerClient := pricer.New(cfg.PricerURL)

	holdingsH := handler.NewHoldingsHandler(cfg, pricerClient)
	portfolioH := handler.NewPortfolioHandler(cfg, pricerClient)
	watchlistH := handler.NewWatchlistHandler(store)
	coreH := handler.NewCoreHandler(cfg)
	cashFlowH := handler.NewCashFlowHandler(cfg)
	incomeH := handler.NewIncomeHandler(cfg)
	realizedH := handler.NewRealizedHandler(cfg)
	taxH := handler.NewTaxHandler(cfg)
	analyticsH := handler.NewAnalyticsHandler(cfg, pricerClient)
	assetH := handler.NewAssetHandler(cfg, pricerClient)
	miscH := handler.NewMiscHandler(cfg, pricerClient)
	marketH := handler.NewMarketHandler(cfg)

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	api := r.Group("/api")

	// Core
	api.GET("/health", coreH.Health)
	api.GET("/exports", coreH.Exports)

	// Portfolio summary
	api.GET("/summary", portfolioH.Summary)
	api.GET("/portfolio", portfolioH.Overview)

	// Holdings
	api.GET("/holdings", holdingsH.List)
	api.GET("/holdings/:isin", holdingsH.Detail)

	// Asset detail (different shape: current.unrealized vs current.unrealized_pnl)
	api.GET("/asset/:isin", assetH.Get)

	// Financial reports
	api.GET("/position_returns", miscH.PositionReturns)
	api.GET("/performance", miscH.Performance)
	api.GET("/cash_flow", cashFlowH.Get)
	api.GET("/income", incomeH.Get)
	api.GET("/realized", realizedH.Get)
	api.GET("/tax", taxH.Get)
	api.GET("/analytics", analyticsH.Get)

	// Geographic & German tax
	api.GET("/geographic", miscH.Geographic)
	api.GET("/fsa", miscH.FSA)
	api.GET("/dividend_calendar", miscH.DividendCalendar)

	// Watchlist
	api.GET("/watchlist", watchlistH.Get)
	api.POST("/watchlist", watchlistH.Add)
	api.DELETE("/watchlist/:isin", watchlistH.Remove)

	// Market data (proxied to Python pricer)
	api.GET("/market/search", marketH.Search)
	api.GET("/market/quote", marketH.Quote)
	api.GET("/market/history", marketH.History)
	api.GET("/market/news", marketH.News)

	// Actions
	api.POST("/refresh_prices", miscH.RefreshPrices)
	api.POST("/upload", miscH.Upload)

	addr := ":" + cfg.Port
	_, certErr := os.Stat(cfg.TLSCert)
	_, keyErr := os.Stat(cfg.TLSKey)
	if certErr == nil && keyErr == nil {
		log.Printf("Go backend (HTTPS) on %s", addr)
		if err := r.RunTLS(addr, cfg.TLSCert, cfg.TLSKey); err != nil {
			log.Fatal(err)
		}
	} else {
		log.Printf("Go backend (HTTP) on %s  [no TLS certs found]", addr)
		if err := r.Run(addr); err != nil {
			log.Fatal(err)
		}
	}
}
