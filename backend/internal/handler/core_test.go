package handler_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/manimovassagh/portfolio/internal/config"
	"github.com/manimovassagh/portfolio/internal/handler"
)

type mockStore struct{ err error }

func (m *mockStore) Ping() error { return m.err }

type mockPricer struct{ err error }

func (m *mockPricer) Health() error { return m.err }

func newRouter(cfg config.Config, store interface{ Ping() error }, pricer interface{ Health() error }) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := handler.NewCoreHandler(cfg, store, pricer)
	r.GET("/api/health", h.Health)
	r.GET("/api/readyz", h.Readyz)
	return r
}

func TestReadyz_AllHealthy(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{ExportsDir: dir}

	r := newRouter(cfg, &mockStore{}, &mockPricer{})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/readyz", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("expected status ok, got %v", body["status"])
	}
	checks := body["checks"].(map[string]interface{})
	if checks["db"] != "ok" {
		t.Errorf("expected db ok, got %v", checks["db"])
	}
	if checks["exports"] != "ok" {
		t.Errorf("expected exports ok, got %v", checks["exports"])
	}
	if checks["pricer"] != "ok" {
		t.Errorf("expected pricer ok, got %v", checks["pricer"])
	}
}

func TestReadyz_DBFail(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{ExportsDir: dir}

	r := newRouter(cfg, &mockStore{err: errors.New("connection refused")}, &mockPricer{})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/readyz", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["status"] != "degraded" {
		t.Errorf("expected status degraded, got %v", body["status"])
	}
	checks := body["checks"].(map[string]interface{})
	if checks["db"] == "ok" {
		t.Errorf("expected db failure, got ok")
	}
}

func TestReadyz_ExportsDirMissing(t *testing.T) {
	cfg := config.Config{ExportsDir: "/nonexistent/path/that/does/not/exist"}

	r := newRouter(cfg, &mockStore{}, &mockPricer{})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/readyz", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["status"] != "degraded" {
		t.Errorf("expected status degraded, got %v", body["status"])
	}
	checks := body["checks"].(map[string]interface{})
	if checks["exports"] == "ok" {
		t.Errorf("expected exports failure, got ok")
	}
}

func TestReadyz_PricerFail(t *testing.T) {
	dir := t.TempDir()
	cfg := config.Config{ExportsDir: dir}

	r := newRouter(cfg, &mockStore{}, &mockPricer{err: errors.New("pricer unreachable: connection refused")})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/readyz", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["status"] != "degraded" {
		t.Errorf("expected status degraded, got %v", body["status"])
	}
	checks := body["checks"].(map[string]interface{})
	if checks["pricer"] == "ok" {
		t.Errorf("expected pricer failure, got ok")
	}
}

func TestHealth(t *testing.T) {
	cfg := config.Config{}
	r := newRouter(cfg, &mockStore{}, &mockPricer{})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/api/health", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
