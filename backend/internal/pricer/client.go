package pricer

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// GetPrices fetches live prices for the given ISINs from the Python pricer.
// Returns nil and an error if the pricer is unreachable.
func (c *Client) GetPrices(isins []string) (map[string]float64, error) {
	if len(isins) == 0 {
		return map[string]float64{}, nil
	}
	url := fmt.Sprintf("%s/prices?isins=%s", c.baseURL, strings.Join(isins, ","))
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("pricer unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("pricer returned %d", resp.StatusCode)
	}

	var prices map[string]float64
	if err := json.NewDecoder(resp.Body).Decode(&prices); err != nil {
		return nil, fmt.Errorf("decode pricer response: %w", err)
	}
	return prices, nil
}
