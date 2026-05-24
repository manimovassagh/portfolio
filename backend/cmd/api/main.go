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
	defer func() { _ = store.Close() }()

	pricerClient := pricer.New(cfg.PricerURL)

	holdingsH := handler.NewHoldingsHandler(cfg, pricerClient)
	portfolioH := handler.NewPortfolioHandler(cfg, pricerClient)
	watchlistH := handler.NewWatchlistHandler(store, pricerClient)
	coreH := handler.NewCoreHandler(cfg, store, pricerClient)
	authH := handler.NewAuthHandler(cfg, store)
	cashFlowH := handler.NewCashFlowHandler(cfg)
	incomeH := handler.NewIncomeHandler(cfg)
	realizedH := handler.NewRealizedHandler(cfg)
	taxH := handler.NewTaxHandler(cfg)
	analyticsH := handler.NewAnalyticsHandler(cfg, pricerClient)
	assetH := handler.NewAssetHandler(cfg, pricerClient)
	miscH := handler.NewMiscHandler(cfg, pricerClient)
	marketH := handler.NewMarketHandler(cfg)
	pricesWSH := handler.NewPricesWSHandler(cfg, pricerClient)

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	api := r.Group("/api")

	// Core
	api.GET("/health", coreH.Health)
	api.GET("/readyz", coreH.Readyz)

	// Auth
	api.GET("/auth/session", authH.Session)
	api.GET("/auth/providers", authH.Providers)
	api.POST("/auth/register", authH.Register)
	api.POST("/auth/login", authH.Login)
	api.POST("/auth/google", authH.Google)
	api.POST("/auth/apple", authH.Apple)
	api.POST("/auth/dev", authH.DevLogin)
	api.POST("/auth/logout", authH.Logout)

	publicData := api.Group("")
	publicData.Use(middleware.OptionalSession(cfg, store))

	publicData.GET("/exports", coreH.Exports)

	// Portfolio summary
	publicData.GET("/summary", portfolioH.Summary)
	publicData.GET("/portfolio", portfolioH.Overview)

	// Holdings
	publicData.GET("/holdings", holdingsH.List)
	publicData.GET("/holdings/export", holdingsH.Export)
	publicData.GET("/holdings/:isin", holdingsH.Detail)

	// Asset detail (different shape: current.unrealized vs current.unrealized_pnl)
	publicData.GET("/asset/:isin", assetH.Get)

	// Financial reports
	publicData.GET("/position_returns", miscH.PositionReturns)
	publicData.GET("/performance", middleware.RateLimit(10, 5), miscH.Performance)
	publicData.GET("/cash_flow", cashFlowH.Get)
	publicData.GET("/income", incomeH.Get)
	publicData.GET("/realized", realizedH.Get)
	publicData.GET("/tax", taxH.Get)
	publicData.GET("/analytics", middleware.RateLimit(10, 5), analyticsH.Get)

	// Geographic & German tax
	publicData.GET("/geographic", miscH.Geographic)
	publicData.GET("/fsa", miscH.FSA)
	publicData.GET("/dividend_calendar", miscH.DividendCalendar)

	// Watchlist
	protected := api.Group("")
	protected.Use(middleware.RequireSession(cfg, store))
	protected.GET("/watchlist", watchlistH.Get)
	protected.POST("/watchlist", watchlistH.Add)
	protected.DELETE("/watchlist/:isin", watchlistH.Remove)

	// Market data (proxied to Python pricer)
	api.GET("/market/search", middleware.RateLimit(5, 3), marketH.Search)
	api.GET("/market/quote", middleware.RateLimit(5, 3), marketH.Quote)
	api.GET("/market/history", middleware.RateLimit(5, 3), marketH.History)
	api.GET("/market/news", middleware.RateLimit(5, 3), marketH.News)

	// WebSocket live prices
	publicData.GET("/ws/prices", pricesWSH.Stream)

	// Actions
	publicData.POST("/refresh_prices", miscH.RefreshPrices)
	protected.POST("/upload", miscH.Upload)

	// Docs (outside /api group — no auth required)
	r.GET("/docs", coreH.DocsUI)
	r.GET("/docs/openapi.yaml", coreH.DocsSpec)

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
