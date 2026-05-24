package auth0

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/auth0/go-jwt-middleware/v3/jwks"
	"github.com/auth0/go-jwt-middleware/v3/validator"
)

type Profile struct {
	Subject  string `json:"sub"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Nickname string `json:"nickname"`
}

func Verify(ctx context.Context, domain, audience, token string) (Profile, error) {
	domain = strings.TrimSpace(domain)
	audience = strings.TrimSpace(audience)
	token = strings.TrimSpace(token)
	if domain == "" || audience == "" {
		return Profile{}, errors.New("auth0 is not configured")
	}
	if token == "" {
		return Profile{}, errors.New("missing bearer token")
	}

	issuerURL, err := url.Parse("https://" + domain + "/")
	if err != nil {
		return Profile{}, fmt.Errorf("parse auth0 issuer: %w", err)
	}

	provider, err := jwks.NewCachingProvider(
		jwks.WithIssuerURL(issuerURL),
		jwks.WithCacheTTL(5*time.Minute),
	)
	if err != nil {
		return Profile{}, fmt.Errorf("create jwks provider: %w", err)
	}

	jwtValidator, err := validator.New(
		validator.WithKeyFunc(provider.KeyFunc),
		validator.WithAlgorithm(validator.RS256),
		validator.WithIssuer(issuerURL.String()),
		validator.WithAudience(audience),
		validator.WithAllowedClockSkew(30*time.Second),
	)
	if err != nil {
		return Profile{}, fmt.Errorf("create auth0 validator: %w", err)
	}

	if _, err := jwtValidator.ValidateToken(ctx, token); err != nil {
		return Profile{}, fmt.Errorf("validate auth0 token: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://"+domain+"/userinfo", nil)
	if err != nil {
		return Profile{}, fmt.Errorf("create userinfo request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return Profile{}, fmt.Errorf("load auth0 profile: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return Profile{}, fmt.Errorf("userinfo returned http %d", resp.StatusCode)
	}

	var profile Profile
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return Profile{}, fmt.Errorf("decode auth0 profile: %w", err)
	}
	profile.Subject = strings.TrimSpace(profile.Subject)
	profile.Email = strings.TrimSpace(profile.Email)
	profile.Name = strings.TrimSpace(profile.Name)
	profile.Nickname = strings.TrimSpace(profile.Nickname)
	if profile.Subject == "" {
		return Profile{}, errors.New("auth0 profile missing subject")
	}
	return profile, nil
}
