const { createProxyMiddleware } = require('http-proxy-middleware');
const { 
    authenticateToken, 
    handleAuthRoutes, 
    protectedRoute, 
    adminRoute,
    publicRoute
} = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupUserRoutes = (app, serviceRegistry) => {
    const serviceName = 'user';
    
    // Crear proxy hacia user-service con manejo de errores
    const createUserProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: () => serviceRegistry.getServiceInstance(serviceName),
            changeOrigin: true,
            pathRewrite,
            timeout: 30000,
            
            onProxyReq: (proxyReq, req, res) => {
                // Los headers ya fueron agregados por los middlewares de auth
                logger.debug(`Proxy request to user-service: ${req.method} ${req.url}`, {
                    target: proxyReq.getHeader('host'),
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id']
                });
            },
            
            onProxyRes: (proxyRes, req, res) => {
                logger.debug(`Proxy response from user-service: ${proxyRes.statusCode}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id']
                });
            },
            
            onError: (err, req, res) => {
                logger.error(`Error en user-service proxy: ${err.message}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id'],
                    error: err.message
                });
                
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        success: false,
                        error: 'Servicio de usuarios no disponible',
                        code: 'USER_SERVICE_UNAVAILABLE',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    };

    // 🔓 Rutas públicas de autenticación
    app.post('/api/auth/register', 
        handleAuthRoutes,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/auth/register': '/api/users/register' })
    );

    app.post('/api/auth/login', 
        handleAuthRoutes,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/auth/login': '/api/users/login' })
    );

    app.post('/api/auth/forgot-password', 
        handleAuthRoutes,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/auth/forgot-password': '/api/users/forgot-password' })
    );

    app.post('/api/auth/reset-password', 
        handleAuthRoutes,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/auth/reset-password': '/api/users/reset-password' })
    );

    // 🔒 Rutas protegidas de usuario
    app.get('/api/users/profile',
        ...protectedRoute,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/users/profile': '/api/users/profile' })
    );

    app.put('/api/users/profile',
        ...protectedRoute,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/users/profile': '/api/users/profile' })
    );

    // 🔒 Rutas de administración de usuarios
    app.get('/api/admin/users',
        ...adminRoute,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/admin/users': '/api/users/admin' })
    );

    app.put('/api/admin/users/:userId',
        ...adminRoute,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/admin/users': '/api/users/admin' })
    );

    logger.info('✅ User routes configuradas completamente');
};

module.exports = setupUserRoutes;