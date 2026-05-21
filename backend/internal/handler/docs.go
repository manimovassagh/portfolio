package handler

import (
	_ "embed"

	"github.com/gin-gonic/gin"
)

//go:embed static/openapi.yaml
var openapiSpec []byte

// DocsSpec serves the raw OpenAPI 3.0 YAML spec.
func (h *CoreHandler) DocsSpec(c *gin.Context) {
	c.Data(200, "application/yaml; charset=utf-8", openapiSpec)
}

// DocsUI serves a Swagger UI HTML page that loads the spec from /docs/openapi.yaml.
func (h *CoreHandler) DocsUI(c *gin.Context) {
	html := `<!DOCTYPE html>
<html>
<head>
  <title>Kapital API</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({
  url: "/docs/openapi.yaml",
  dom_id: "#swagger-ui",
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
  layout: "BaseLayout",
  deepLinking: true
});
</script>
</body>
</html>`
	c.Data(200, "text/html; charset=utf-8", []byte(html))
}
