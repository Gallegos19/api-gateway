const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupOrderRoutes = (app, serviceRegistry) => {
    const serviceName = 'order';
    
    const createOrderProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: () => serviceRegistry.getServiceInstance(serviceName),
            changeOrigin: true,
            pathRewrite,
            timeout: 45000, // Un poco más largo para órdenes
            
            onProxyReq: (proxyReq, req, res) => {
                if (req.user) {
                    proxyReq.setHeader('x-user-id', req.user.id);
                    proxyReq.setHeader('x-user-email', req.user.email);
                    proxyReq.setHeader('x-user-role', req.user.role);
                }
                proxyReq.setHeader('x-request-id', req.requestId);
            },
            
            onError: (err, req, res) => {
                logger.error(`Error en order-service: ${err.message}`);
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        error: 'Servicio de pedidos no disponible',
                        code: 'ORDER_SERVICE_UNAVAILABLE'
                    });
                }
            }
        });
    };

    // 🔒 Rutas para usuarios
    app.get('/api/orders', 
        authenticateToken,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders': '/orders' })
    );

    app.post('/api/orders', 
        authenticateToken,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders': '/orders' })
    );

    app.get('/api/orders/:id', 
        authenticateToken,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders': '/orders' })
    );

    app.put('/api/orders/:id/cancel', 
        authenticateToken,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders': '/orders' })
    );

    // 🔒 Rutas de administración básicas
    app.get('/api/admin/orders', 
        authenticateToken,
        authorizeRoles('admin'),
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/admin/orders': '/admin/orders' })
    );

    app.put('/api/admin/orders/:id/status', 
        authenticateToken,
        authorizeRoles('admin'),
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/admin/orders': '/admin/orders' })
    );

    logger.info('✅ Order routes configuradas (básicas)');
};

module.exports = setupOrderRoutes;