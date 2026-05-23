package db

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
	"strings"
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
	if err := s.ensureUserPasswordHashColumn(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) Ping() error { return s.db.Ping() }

func (s *Store) migrate() error {
	_, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS watchlist (
		user_id      TEXT NOT NULL DEFAULT '',
		isin         TEXT PRIMARY KEY,
		ticker       TEXT NOT NULL DEFAULT '',
		name         TEXT NOT NULL DEFAULT '',
		notes        TEXT NOT NULL DEFAULT '',
		target_price REAL,
		added_date   TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS user_watchlist (
		user_id      TEXT NOT NULL,
		isin         TEXT NOT NULL,
		ticker       TEXT NOT NULL DEFAULT '',
		name         TEXT NOT NULL DEFAULT '',
		notes        TEXT NOT NULL DEFAULT '',
		target_price REAL,
		added_date   TEXT NOT NULL,
		PRIMARY KEY (user_id, isin),
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);
	CREATE TABLE IF NOT EXISTS users (
		id               TEXT PRIMARY KEY,
		provider         TEXT NOT NULL,
		provider_subject TEXT NOT NULL,
		email            TEXT NOT NULL DEFAULT '',
		name             TEXT NOT NULL DEFAULT '',
		password_hash    TEXT NOT NULL DEFAULT '',
		created_at       TEXT NOT NULL,
		UNIQUE(provider, provider_subject)
	);
	CREATE TABLE IF NOT EXISTS sessions (
		token      TEXT PRIMARY KEY,
		user_id    TEXT NOT NULL,
		expires_at TEXT NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);
	CREATE TABLE IF NOT EXISTS passkey_credentials (
		id         TEXT PRIMARY KEY,
		user_id    TEXT NOT NULL,
		public_key BLOB NOT NULL,
		sign_count INTEGER NOT NULL DEFAULT 0,
		aaguid     TEXT NOT NULL DEFAULT '',
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	)`)
	return err
}

func (s *Store) ensureUserPasswordHashColumn() error {
	rows, err := s.db.Query(`PRAGMA table_info(users)`)
	if err != nil {
		return err
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		var cid int
		var name, colType string
		var notnull int
		var dfltValue any
		var pk int
		if err := rows.Scan(&cid, &name, &colType, &notnull, &dfltValue, &pk); err != nil {
			return err
		}
		if name == "password_hash" {
			return nil
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	_, err = s.db.Exec(`ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''`)
	return err
}

func (s *Store) GetWatchlist(userID string) ([]model.WatchlistItem, error) {
	rows, err := s.db.Query(
		`SELECT isin, ticker, name, notes, target_price, added_date FROM user_watchlist WHERE user_id = ? ORDER BY added_date DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

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

func (s *Store) AddWatchlistItem(userID string, item model.WatchlistItem) error {
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO user_watchlist (user_id, isin, ticker, name, notes, target_price, added_date)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		userID, item.ISIN, item.Ticker, item.Name, item.Notes, item.TargetPrice, item.AddedDate)
	return err
}

func (s *Store) RemoveWatchlistItem(userID, isin string) error {
	_, err := s.db.Exec(`DELETE FROM user_watchlist WHERE user_id = ? AND isin = ?`, userID, isin)
	return err
}

func (s *Store) CreateUser(provider, providerSubject, email, name string) (model.User, error) {
	id := provider + ":" + providerSubject
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec(
		`INSERT INTO users (id, provider, provider_subject, email, name, password_hash, created_at)
		 VALUES (?, ?, ?, ?, ?, '', ?)
		 ON CONFLICT(provider, provider_subject) DO UPDATE SET
			email = excluded.email,
			name = excluded.name`,
		id, provider, providerSubject, email, name, now)
	if err != nil {
		return model.User{}, err
	}
	return s.getUserByID(id)
}

func (s *Store) CreateLocalUser(email, name, passwordHash string) (model.User, error) {
	normEmail := normalizeEmail(email)
	id := "local:" + normEmail
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec(
		`INSERT INTO users (id, provider, provider_subject, email, name, password_hash, created_at)
		 VALUES (?, 'local', ?, ?, ?, ?, ?)`,
		id, normEmail, email, name, passwordHash, now)
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

func (s *Store) GetLocalUserByEmail(email string) (model.User, string, error) {
	var user model.User
	var passwordHash string
	err := s.db.QueryRow(
		`SELECT id, provider, provider_subject, email, name, password_hash, created_at
		 FROM users
		 WHERE provider = 'local' AND provider_subject = ?`,
		normalizeEmail(email),
	).Scan(&user.ID, &user.Provider, &user.ProviderSubject, &user.Email, &user.Name, &passwordHash, &user.CreatedAt)
	return user, passwordHash, err
}

func newSessionToken() (string, error) {
	var b [32]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b[:]), nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// SavePasskeyCredential stores a new passkey credential for a user.
func (s *Store) SavePasskeyCredential(userID, credID string, publicKey []byte, signCount uint32, aaguid string) error {
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO passkey_credentials (id, user_id, public_key, sign_count, aaguid)
		 VALUES (?, ?, ?, ?, ?)`,
		credID, userID, publicKey, signCount, aaguid)
	return err
}

// UpdatePasskeySignCount updates the signature counter for a credential.
func (s *Store) UpdatePasskeySignCount(credID string, signCount uint32) error {
	_, err := s.db.Exec(
		`UPDATE passkey_credentials SET sign_count = ? WHERE id = ?`,
		signCount, credID)
	return err
}

// GetPasskeyCredentials returns all stored passkey credentials for a user.
func (s *Store) GetPasskeyCredentials(userID string) ([]PasskeyCredRow, error) {
	rows, err := s.db.Query(
		`SELECT id, public_key, sign_count, aaguid FROM passkey_credentials WHERE user_id = ?`, userID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var out []PasskeyCredRow
	for rows.Next() {
		var c PasskeyCredRow
		if err := rows.Scan(&c.ID, &c.PublicKey, &c.SignCount, &c.AAGUID); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetUserByPasskeyCredID looks up the user and credential row for a given credential ID.
func (s *Store) GetUserByPasskeyCredID(credID string) (model.User, PasskeyCredRow, error) {
	var user model.User
	var cred PasskeyCredRow
	err := s.db.QueryRow(
		`SELECT u.id, u.provider, u.provider_subject, u.email, u.name, u.created_at,
		        c.id, c.public_key, c.sign_count, c.aaguid
		 FROM passkey_credentials c
		 JOIN users u ON u.id = c.user_id
		 WHERE c.id = ?`, credID,
	).Scan(
		&user.ID, &user.Provider, &user.ProviderSubject, &user.Email, &user.Name, &user.CreatedAt,
		&cred.ID, &cred.PublicKey, &cred.SignCount, &cred.AAGUID,
	)
	return user, cred, err
}

// PasskeyCredRow is a raw credential row from the DB.
type PasskeyCredRow struct {
	ID        string
	PublicKey []byte
	SignCount uint32
	AAGUID    string
}
