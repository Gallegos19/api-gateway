const { createProxyMiddleware } = require('http-proxy-middleware');
const { protectedRoute, adminRoute } = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupCartRoutes = (app, serviceRegistry) => {
    const serviceName = 'cart';
    
    const createCartProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: () => serviceRegistry.getServiceInstance(serviceName),
            changeOrigin: true,
            pathRewrite,
            timeout: 30000,
            
            onProxyReq: (proxyReq, req, res) => {
                logger.debug(`Proxy request to cart-service: ${req.method} ${req.url}`, {
                    target: proxyReq.getHeader('host'),
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id']
                });
            },
            
            onProxyRes: (proxyRes, req, res) => {
                logger.debug(`Proxy response from cart-service: ${proxyRes.statusCode}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id']
                });
            },
            
            onError: (err, req, res) => {
                logger.error(`Error en cart-service proxy: ${err.message}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id'],
                    error: err.message
                });
                
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        success: false,
                        error: 'Servicio de carrito no disponible',
                        code: 'CART_SERVICE_UNAVAILABLE',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    };

    // 🔒 Todas las rutas de carrito requieren autenticación
    app.get('/api/cart', 
        ...protectedRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart': '/api/cart' })
    );

    app.post('/api/cart/items', 
        ...protectedRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart': '/api/cart' })
    );

    app.put('/api/cart/items/:itemId', 
        ...protectedRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart': '/api/cart' })
    );

    app.delete('/api/cart/items/:itemId', 
        ...protectedRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart': '/api/cart' })
    );

    app.delete('/api/cart', 
        ...protectedRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart': '/api/cart' })
    );

    // 🔒 Rutas de administración de carritos
    app.get('/api/admin/carts',
        ...adminRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/admin/carts': '/api/admin/carts' })
    );

    app.get('/api/admin/carts/abandoned',
        ...adminRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/admin/carts': '/api/admin/carts' })
    );

    logger.info('✅ Cart routes configuradas completamente');
};

module.exports = setupCartRoutes;