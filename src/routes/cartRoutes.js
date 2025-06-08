const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticateToken } = require('../middleware/auth');
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
                if (req.user) {
                    proxyReq.setHeader('x-user-id', req.user.id);
                    proxyReq.setHeader('x-user-email', req.user.email);
                }
                proxyReq.setHeader('x-request-id', req.requestId);
            },
            
            onError: (err, req, res) => {
                logger.error(`Error en cart-service: ${err.message}`);
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        error: 'Servicio de carrito no disponible',
                        code: 'CART_SERVICE_UNAVAILABLE'
                    });
                }
            }
        });
    };

    // 🔒 Todas las rutas de carrito requieren autenticación
    app.get('/api/cart', 
        authenticateToken,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart': '/cart' })
    );

    app.post('/api/cart/items', 
        authenticateToken,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart': '/cart' })
    );

    app.put('/api/cart/items/:itemId', 
        authenticateToken,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart': '/cart' })
    );

    app.delete('/api/cart/items/:itemId', 
        authenticateToken,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart': '/cart' })
    );

    app.delete('/api/cart', 
        authenticateToken,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart': '/cart' })
    );

    logger.info('✅ Cart routes configuradas (básicas)');
};

module.exports = setupCartRoutes;
