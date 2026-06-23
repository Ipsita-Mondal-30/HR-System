const swaggerJsdoc = require('swagger-jsdoc');
const swaggerOptions = require('./swaggerOptions');

let cachedSpec = null;

function getOpenApiSpec() {
  if (!cachedSpec) {
    cachedSpec = swaggerJsdoc(swaggerOptions);
  }
  return cachedSpec;
}

async function setupApiDocs(app) {
  const { apiReference } = await import('@scalar/express-api-reference');

  app.get('/api-docs/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(getOpenApiSpec());
  });

  app.use(
    '/api-docs',
    apiReference({
      url: '/api-docs/openapi.json',
      theme: 'purple',
      layout: 'modern',
      persistAuth: true,
      metaData: {
        title: 'HR System API Reference',
        description: 'Interactive API documentation powered by Scalar and OpenAPI',
      },
      authentication: {
        preferredSecurityScheme: 'bearerAuth',
      },
    })
  );

  console.log('📚 API docs available at /api-docs');
}

module.exports = { setupApiDocs, getOpenApiSpec };
