package db

import (
	"database/sql"
	"fmt"

	"github.com/manimovassagh/portfolio/internal/model"
	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	conn, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}
	s := &Store{db: conn}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() { s.db.Close() }

func (s *Store) migrate() error {
	_, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS watchlist (
		isin         TEXT PRIMARY KEY,
		ticker       TEXT NOT NULL DEFAULT '',
		name         TEXT NOT NULL DEFAULT '',
		notes        TEXT NOT NULL DEFAULT '',
		target_price REAL,
		added_date   TEXT NOT NULL
	)`)
	return err
}

func (s *Store) GetWatchlist() ([]model.WatchlistItem, error) {
	rows, err := s.db.Query(
		`SELECT isin, ticker, name, notes, target_price, added_date FROM watchlist ORDER BY added_date DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.WatchlistItem
	for rows.Next() {
		var item model.WatchlistItem
		if err := rows.Scan(&item.ISIN, &item.Ticker, &item.Name,
			&item.Notes, &item.TargetPrice, &item.AddedDate); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if items == nil {
		items = []model.WatchlistItem{}
	}
	return items, rows.Err()
}

func (s *Store) AddWatchlistItem(item model.WatchlistItem) error {
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO watchlist (isin, ticker, name, notes, target_price, added_date)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		item.ISIN, item.Ticker, item.Name, item.Notes, item.TargetPrice, item.AddedDate)
	return err
}

func (s *Store) RemoveWatchlistItem(isin string) error {
	_, err := s.db.Exec(`DELETE FROM watchlist WHERE isin = ?`, isin)
	return err
}
