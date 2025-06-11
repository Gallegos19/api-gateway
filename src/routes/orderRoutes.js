const { createProxyMiddleware } = require('http-proxy-middleware');
const { protectedRoute, adminRoute } = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupOrderRoutes = (app, serviceRegistry) => {
    const serviceName = 'order';
    
    const createOrderProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: () => serviceRegistry.getServiceInstance(serviceName),
            changeOrigin: true,
            pathRewrite,
            timeout: 45000, // Timeout más largo para órdenes
            
            onProxyReq: (proxyReq, req, res) => {
                logger.debug(`Proxy request to order-service: ${req.method} ${req.url}`, {
                    target: proxyReq.getHeader('host'),
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id']
                });
            },
            
            onProxyRes: (proxyRes, req, res) => {
                logger.debug(`Proxy response from order-service: ${proxyRes.statusCode}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id']
                });
            },
            
            onError: (err, req, res) => {
                logger.error(`Error en order-service proxy: ${err.message}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id'],
                    error: err.message
                });
                
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        success: false,
                        error: 'Servicio de pedidos no disponible',
                        code: 'ORDER_SERVICE_UNAVAILABLE',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    };

    // 🔒 Rutas de órdenes para usuarios autenticados
    app.get('/api/orders', 
        ...protectedRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders': '/api/orders' })
    );

    app.post('/api/orders', 
        ...protectedRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders': '/api/orders' })
    );

    app.get('/api/orders/:id', 
        ...protectedRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders': '/api/orders' })
    );

    app.put('/api/orders/:id/cancel', 
        ...protectedRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders': '/api/orders' })
    );

    // 🔒 Rutas de administración de órdenes
    app.get('/api/admin/orders', 
        ...adminRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/admin/orders': '/api/admin/orders' })
    );

    app.put('/api/admin/orders/:id/status', 
        ...adminRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/admin/orders': '/api/admin/orders' })
    );

    app.get('/api/admin/orders/stats',
        ...adminRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/admin/orders': '/api/admin/orders' })
    );

    app.patch('/api/admin/orders/:id/ship',
        ...adminRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/admin/orders': '/api/admin/orders' })
    );

    logger.info('✅ Order routes configuradas completamente');
};

module.exports = setupOrderRoutes;