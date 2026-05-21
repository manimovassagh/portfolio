package main

import (
	"log"

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

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.CORS())
	r.Use(middleware.Logger())

	coreH := handler.NewCoreHandler(cfg)

	api := r.Group("/api")
	api.GET("/health", coreH.Health)
	api.GET("/exports", coreH.Exports)
	api.GET("/holdings", holdingsH.List)
	api.GET("/holdings/:isin", holdingsH.Detail)
	api.GET("/portfolio", portfolioH.Overview)
	api.GET("/watchlist", watchlistH.Get)
	api.POST("/watchlist", watchlistH.Add)
	api.DELETE("/watchlist/:isin", watchlistH.Remove)

	log.Printf("Go backend on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
