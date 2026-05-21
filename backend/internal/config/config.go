package config

import "os"

type Config struct {
	Port         string
	DBPath       string
	PricerURL    string
	TLSCert      string
	TLSKey       string
	ExportsDir   string
	AuthRequired bool
	CookieSecure bool
}

func Load() Config {
	return Config{
		Port:         getEnv("PORT", "8766"),
		DBPath:       getEnv("DB_PATH", "../portfolio.db"),
		PricerURL:    getEnv("PRICER_URL", "http://localhost:8001"),
		TLSCert:      getEnv("TLS_CERT", "../certs/cert.pem"),
		TLSKey:       getEnv("TLS_KEY", "../certs/key.pem"),
		ExportsDir:   getEnv("EXPORTS_DIR", "../exports"),
		AuthRequired: getBoolEnv("AUTH_REQUIRED", false),
		CookieSecure: getBoolEnv("AUTH_COOKIE_SECURE", false),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getBoolEnv(key string, fallback bool) bool {
	switch os.Getenv(key) {
	case "1", "true", "TRUE", "yes", "YES", "on", "ON":
		return true
	case "0", "false", "FALSE", "no", "NO", "off", "OFF":
		return false
	default:
		return fallback
	}
}
