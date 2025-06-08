const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticateToken } = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupUserRoutes = (app, serviceRegistry) => {
    const serviceName = 'user';
    
    // Proxy simple hacia user-service
    const createUserProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: () => serviceRegistry.getServiceInstance(serviceName),
            changeOrigin: true,
            pathRewrite,
            timeout: 30000,
            
            onProxyReq: (proxyReq, req, res) => {
                // Solo headers básicos que necesita tu user-service
                if (req.user) {
                    proxyReq.setHeader('x-user-id', req.user.id);
                    proxyReq.setHeader('x-user-email', req.user.email);
                    proxyReq.setHeader('x-user-role', req.user.role);
                }
                proxyReq.setHeader('x-request-id', req.requestId);
            },
            
            onError: (err, req, res) => {
                logger.error(`Error en user-service: ${err.message}`);
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        error: 'Servicio de usuarios no disponible',
                        code: 'USER_SERVICE_UNAVAILABLE'
                    });
                }
            }
        });
    };

    // 🔓 Rutas públicas (coinciden con tu user-service actual)
    app.post('/api/auth/register', 
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/auth/register': '/register' })
    );

    app.post('/api/auth/login', 
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/auth/login': '/login' })
    );

    app.post('/api/auth/forgot-password', 
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/auth/forgot-password': '/forgot-password' })
    );

    app.post('/api/auth/reset-password', 
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/auth/reset-password': '/reset-password' })
    );

    // 🔒 Rutas protegidas (coinciden con tu user-service actual)
    app.get('/api/users/profile',
        authenticateToken,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/users/profile': '/profile' })
    );

    app.put('/api/users/profile',
        authenticateToken,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/users/profile': '/profile' })
    );

    logger.info('✅ User routes configuradas (básicas)');
};

module.exports = setupUserRoutes;
