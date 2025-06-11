const { createProxyMiddleware } = require('http-proxy-middleware');
const { 
    publicRoute, 
    adminRoute, 
    optionalAuth,
    addUserHeaders 
} = require('../middleware/auth');
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
                logger.debug(`Proxy request to product-service: ${req.method} ${req.url}`, {
                    target: proxyReq.getHeader('host'),
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id']
                });
            },
            
            onProxyRes: (proxyRes, req, res) => {
                logger.debug(`Proxy response from product-service: ${proxyRes.statusCode}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id']
                });
            },
            
            onError: (err, req, res) => {
                logger.error(`Error en product-service proxy: ${err.message}`, {
                    method: req.method,
                    url: req.url,
                    error: err.message
                });
                
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        success: false,
                        error: 'Servicio de productos no disponible',
                        code: 'PRODUCT_SERVICE_UNAVAILABLE',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    };

    // 🔓 Rutas públicas de productos (con autenticación opcional para logs)
    app.get('/api/products', 
        optionalAuth,
        addUserHeaders,
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/api/products' })
    );

    app.get('/api/products/:id', 
        optionalAuth,
        addUserHeaders,
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/api/products' })
    );

    // Búsqueda de productos (público)
    app.get('/api/products/search/:term',
        optionalAuth,
        addUserHeaders,
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/api/products' })
    );

    // Productos por categoría (público)
    app.get('/api/products/category/:category',
        optionalAuth,
        addUserHeaders,
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/api/products' })
    );

    // 🔒 Rutas de administración de productos
    app.post('/api/products', 
        ...adminRoute,
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/api/products' })
    );

    app.put('/api/products/:id', 
        ...adminRoute,
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/api/products' })
    );

    app.delete('/api/products/:id', 
        ...adminRoute,
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/products': '/api/products' })
    );

    // Rutas específicas de administración
    app.get('/api/admin/products',
        ...adminRoute,
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/admin/products': '/api/admin/products' })
    );

    app.get('/api/admin/products/stats',
        ...adminRoute,
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/admin/products': '/api/admin/products' })
    );

    app.put('/api/admin/products/:id/stock',
        ...adminRoute,
        createServiceRateLimit('products'),
        createProductProxy({ '^/api/admin/products': '/api/admin/products' })
    );

    logger.info('✅ Product routes configuradas completamente');
};

module.exports = setupProductRoutes;