package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

var (
	limiters    sync.Map
	cleanupOnce sync.Once
)

func startCleanup() {
	go func() {
		for range time.Tick(5 * time.Minute) {
			now := time.Now()
			limiters.Range(func(k, v any) bool {
				if now.Sub(v.(*ipLimiter).lastSeen) > 10*time.Minute {
					limiters.Delete(k)
				}
				return true
			})
		}
	}()
}

func getLimiter(ip string, rps float64, burst int) *rate.Limiter {
	cleanupOnce.Do(startCleanup)
	v, _ := limiters.LoadOrStore(ip, &ipLimiter{
		limiter: rate.NewLimiter(rate.Limit(rps), burst),
	})
	il := v.(*ipLimiter)
	il.lastSeen = time.Now()
	return il.limiter
}

// RateLimit returns middleware that limits expensive endpoints to rps req/s with burst.
func RateLimit(rps float64, burst int) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if !getLimiter(ip, rps, burst).Allow() {
			c.Header("Retry-After", "1")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate limit exceeded"})
			return
		}
		c.Next()
	}
}
