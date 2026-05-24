package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/auth"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/db"
	"github.com/manimovassagh/portfolio/internal/model"
)

func TestAuthRegisterLoginAndSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = store.Close() }()

	h := NewAuthHandler(config.Config{CookieSecure: false}, store)
	r := gin.New()
	r.POST("/auth/register", h.Register)
	r.POST("/auth/login", h.Login)
	r.GET("/auth/session", h.Session)

	registerBody := `{"email":"mani@example.com","password":"supersecret","name":"Mani"}`
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/auth/register", strings.NewReader(registerBody))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected register 200, got %d: %s", w.Code, w.Body.String())
	}
	if len(w.Result().Cookies()) == 0 || w.Result().Cookies()[0].Name != auth.CookieName {
		t.Fatalf("expected auth cookie after registration")
	}

	var session model.AuthSession
	if err := json.Unmarshal(w.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	if !session.Authenticated || session.User == nil || session.User.Email != "mani@example.com" {
		t.Fatalf("unexpected register session: %+v", session)
	}

	dup := httptest.NewRecorder()
	dupReq := httptest.NewRequest(http.MethodPost, "/auth/register", strings.NewReader(registerBody))
	dupReq.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(dup, dupReq)
	if dup.Code != http.StatusConflict {
		t.Fatalf("expected duplicate register conflict, got %d: %s", dup.Code, dup.Body.String())
	}

	loginBody := `{"email":"mani@example.com","password":"supersecret"}`
	login := httptest.NewRecorder()
	loginReq := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(login, loginReq)

	if login.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d: %s", login.Code, login.Body.String())
	}
	if len(login.Result().Cookies()) == 0 || login.Result().Cookies()[0].Name != auth.CookieName {
		t.Fatalf("expected auth cookie after login")
	}
}

func TestAuthProvidersExposeAuth0Flag(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := NewAuthHandler(config.Config{}, nil)
	r := gin.New()
	r.GET("/auth/providers", h.Providers)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/auth/providers", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected providers 200, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"local":false`) || !strings.Contains(w.Body.String(), `"auth0":false`) || strings.Contains(w.Body.String(), `"passkey":true`) {
		t.Fatalf("unexpected providers payload: %s", w.Body.String())
	}
}
