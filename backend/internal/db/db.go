package db

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
	"time"

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
	);
	CREATE TABLE IF NOT EXISTS users (
		id               TEXT PRIMARY KEY,
		provider         TEXT NOT NULL,
		provider_subject TEXT NOT NULL,
		email            TEXT NOT NULL DEFAULT '',
		name             TEXT NOT NULL DEFAULT '',
		created_at       TEXT NOT NULL,
		UNIQUE(provider, provider_subject)
	);
	CREATE TABLE IF NOT EXISTS sessions (
		token      TEXT PRIMARY KEY,
		user_id    TEXT NOT NULL,
		expires_at TEXT NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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

func (s *Store) CreateUser(provider, providerSubject, email, name string) (model.User, error) {
	id := provider + ":" + providerSubject
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec(
		`INSERT INTO users (id, provider, provider_subject, email, name, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(provider, provider_subject) DO UPDATE SET
			email = excluded.email,
			name = excluded.name`,
		id, provider, providerSubject, email, name, now)
	if err != nil {
		return model.User{}, err
	}
	return s.getUserByID(id)
}

func (s *Store) CreateSession(userID string, expiresAt time.Time) (model.Session, error) {
	token, err := newSessionToken()
	if err != nil {
		return model.Session{}, err
	}
	session := model.Session{Token: token, UserID: userID, ExpiresAt: expiresAt.UTC()}
	_, err = s.db.Exec(
		`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
		session.Token, session.UserID, session.ExpiresAt.Format(time.RFC3339),
	)
	return session, err
}

func (s *Store) GetSession(token string, now time.Time) (model.Session, model.User, error) {
	var session model.Session
	var expires string
	var user model.User
	err := s.db.QueryRow(
		`SELECT s.token, s.user_id, s.expires_at, u.id, u.provider, u.provider_subject, u.email, u.name, u.created_at
		 FROM sessions s
		 JOIN users u ON u.id = s.user_id
		 WHERE s.token = ?`,
		token,
	).Scan(
		&session.Token, &session.UserID, &expires,
		&user.ID, &user.Provider, &user.ProviderSubject, &user.Email, &user.Name, &user.CreatedAt,
	)
	if err != nil {
		return model.Session{}, model.User{}, err
	}
	parsed, err := time.Parse(time.RFC3339, expires)
	if err != nil {
		return model.Session{}, model.User{}, err
	}
	session.ExpiresAt = parsed
	if !session.ExpiresAt.After(now) {
		_ = s.DeleteSession(token)
		return model.Session{}, model.User{}, sql.ErrNoRows
	}
	return session, user, nil
}

func (s *Store) DeleteSession(token string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE token = ?`, token)
	return err
}

func (s *Store) getUserByID(id string) (model.User, error) {
	var user model.User
	err := s.db.QueryRow(
		`SELECT id, provider, provider_subject, email, name, created_at FROM users WHERE id = ?`,
		id,
	).Scan(&user.ID, &user.Provider, &user.ProviderSubject, &user.Email, &user.Name, &user.CreatedAt)
	return user, err
}

func newSessionToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}
