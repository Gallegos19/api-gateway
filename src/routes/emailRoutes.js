const { createProxyMiddleware } = require('http-proxy-middleware');
const { protectedRoute, adminRoute } = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupEmailRoutes = (app, serviceRegistry) => {
    const serviceName = 'email';
    
    const createEmailProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: () => serviceRegistry.getServiceInstance(serviceName),
            changeOrigin: true,
            pathRewrite,
            timeout: 45000, // Timeout más largo para emails
            
            onProxyReq: (proxyReq, req, res) => {
                logger.debug(`Proxy request to email-service: ${req.method} ${req.url}`, {
                    target: proxyReq.getHeader('host'),
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id']
                });
            },
            
            onProxyRes: (proxyRes, req, res) => {
                logger.debug(`Proxy response from email-service: ${proxyRes.statusCode}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id']
                });
            },
            
            onError: (err, req, res) => {
                logger.error(`Error en email-service proxy: ${err.message}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id'],
                    error: err.message
                });
                
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        success: false,
                        error: 'Servicio de email no disponible',
                        code: 'EMAIL_SERVICE_UNAVAILABLE',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    };

    // 🔒 Rutas básicas de email (solo admin)
    app.post('/api/emails/send', 
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/api/email' })
    );

    app.post('/api/emails/welcome',
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/api/email' })
    );

    app.post('/api/emails/order-confirmation',
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/api/email' })
    );

    app.post('/api/emails/password-reset',
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/api/email' })
    );

    app.post('/api/emails/shipping-notification',
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/api/email' })
    );

    app.post('/api/emails/promotion',
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/api/email' })
    );

    // 🔒 Webhooks para eventos automáticos (desde otros servicios)
    app.post('/api/emails/webhook/user-registered',
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/api/email' })
    );

    app.post('/api/emails/webhook/order-created',
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/api/email' })
    );

    app.post('/api/emails/webhook/order-shipped',
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/emails': '/api/email' })
    );

    // 🔒 Rutas de administración de emails
    app.get('/api/admin/emails/stats',
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/admin/emails': '/api/email/stats' })
    );

    app.get('/api/admin/emails/history',
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/admin/emails': '/api/email/history' })
    );

    app.get('/api/admin/emails/test-connection',
        ...adminRoute,
        createServiceRateLimit('emails'),
        createEmailProxy({ '^/api/admin/emails': '/api/email/test-connection' })
    );

    logger.info('✅ Email routes configuradas completamente');
};

module.exports = setupEmailRoutes;
