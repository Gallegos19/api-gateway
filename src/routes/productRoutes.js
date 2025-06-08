const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupProductRoutes = (app, serviceRegistry) => {
    const serviceName = 'product';
    
    const createProductProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: () => serviceRegistry.getServiceInstance(serviceName),
            changeOrigin: true,
            pathRewrite,
            timeout: 30000,
            
            onProxyReq: (proxyReq, req, res) => {
                if (req.user) {
                    proxyReq.setHeader('x-user-id', req.user.id);
                    proxyReq.setHeader('x-user-role', req.user.role);
                }
                proxyReq.setHeader('x-request-id', req.requestId);
            },
            
            onError: (err, req, res) => {
                logger.error(`Error en product-service: ${err.message}`);
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        error: 'Servicio de productos no disponible',
                        code: 'PRODUCT_SERVICE_UNAVAILABLE'
                    });
                }
            }
        });
    };

    // 🔓 Rutas públicas básicas
    app.get('/api/products', 
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/products' })
    );

    app.get('/api/products/:id', 
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/products' })
    );

    // 🔒 Rutas de administración básicas
    app.post('/api/products', 
        authenticateToken,
        authorizeRoles('admin'),
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/products' })
    );

    app.put('/api/products/:id', 
        authenticateToken,
        authorizeRoles('admin'),
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/products' })
    );

    app.delete('/api/products/:id', 
        authenticateToken,
        authorizeRoles('admin'),
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/products' })
    );

    logger.info('✅ Product routes configuradas (básicas)');
};

module.exports = setupProductRoutes;
