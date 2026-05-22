package db_test

import (
	"testing"

	"github.com/manimovassagh/portfolio/internal/db"
	"github.com/manimovassagh/portfolio/internal/model"
)

func TestWatchlistCRUD(t *testing.T) {
	store, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()

	item := model.WatchlistItem{
		ISIN:      "TEST123",
		Ticker:    "TEST",
		Name:      "Test ETF",
		Notes:     "my note",
		AddedDate: "2026-05-21",
	}
	if err := store.AddWatchlistItem(item); err != nil {
		t.Fatalf("add failed: %v", err)
	}

	list, err := store.GetWatchlist()
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ISIN != "TEST123" {
		t.Fatalf("expected 1 item with ISIN TEST123, got %+v", list)
	}

	if err := store.RemoveWatchlistItem("TEST123"); err != nil {
		t.Fatalf("remove failed: %v", err)
	}

	list, _ = store.GetWatchlist()
	if len(list) != 0 {
		t.Fatal("expected empty watchlist after remove")
	}
}
