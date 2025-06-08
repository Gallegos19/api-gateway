const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupEmailRoutes = (app, serviceRegistry) => {
    const serviceName = 'email';
    
    const createEmailProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: () => serviceRegistry.getServiceInstance(serviceName),
            changeOrigin: true,
            pathRewrite,
            timeout: 45000,
            
            onProxyReq: (proxyReq, req, res) => {
                if (req.user) {
                    proxyReq.setHeader('x-user-id', req.user.id);
                    proxyReq.setHeader('x-user-email', req.user.email);
                    proxyReq.setHeader('x-user-role', req.user.role);
                }
                proxyReq.setHeader('x-request-id', req.requestId);
            },
            
            onError: (err, req, res) => {
                logger.error(`Error en email-service: ${err.message}`);
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        error: 'Servicio de email no disponible',
                        code: 'EMAIL_SERVICE_UNAVAILABLE'
                    });
                }
            }
        });
    };

    // 🔒 Rutas básicas de email (solo admin/system)
    app.post('/api/emails/send', 
        authenticateToken,
        authorizeRoles('admin', 'system'),
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/emails' })
    );

    app.get('/api/emails/templates', 
        authenticateToken,
        authorizeRoles('admin'),
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/emails' })
    );

    app.post('/api/emails/templates', 
        authenticateToken,
        authorizeRoles('admin'),
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/emails' })
    );

    logger.info('✅ Email routes configuradas (básicas)');
};

module.exports = setupEmailRoutes;