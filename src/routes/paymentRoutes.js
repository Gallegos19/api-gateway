const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupPaymentRoutes = (app, serviceRegistry) => {
    const serviceName = 'payment';
    
    const createPaymentProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: () => serviceRegistry.getServiceInstance(serviceName),
            changeOrigin: true,
            pathRewrite,
            timeout: 60000, // Timeout largo para pagos
            retries: 0, // Sin reintentos para evitar doble cobro
            
            onProxyReq: (proxyReq, req, res) => {
                if (req.user) {
                    proxyReq.setHeader('x-user-id', req.user.id);
                    proxyReq.setHeader('x-user-email', req.user.email);
                }
                proxyReq.setHeader('x-request-id', req.requestId);
                
                // Para pagos, agregar idempotency si existe
                if (req.headers['x-idempotency-key']) {
                    proxyReq.setHeader('x-idempotency-key', req.headers['x-idempotency-key']);
                }
            },
            
            onError: (err, req, res) => {
                logger.error(`Error CRÍTICO en payment-service: ${err.message}`);
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        error: 'Servicio de pagos no disponible',
                        code: 'PAYMENT_SERVICE_UNAVAILABLE',
                        advice: 'Verifica el estado de tu pago antes de reintentar'
                    });
                }
            }
        });
    };

    // 🔒 Rutas básicas de pagos
    app.post('/api/payments/process', 
        authenticateToken,
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/payments': '/payments' })
    );

    app.get('/api/payments/:id', 
        authenticateToken,
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/payments': '/payments' })
    );

    app.get('/api/payments', 
        authenticateToken,
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/payments': '/payments' })
    );

    // 🔒 Rutas de administración básicas
    app.post('/api/admin/payments/:id/refund', 
        authenticateToken,
        authorizeRoles('admin'),
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/admin/payments': '/admin/payments' })
    );

    app.get('/api/admin/payments', 
        authenticateToken,
        authorizeRoles('admin'),
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/admin/payments': '/admin/payments' })
    );

    logger.info('✅ Payment routes configuradas (básicas)');
};

module.exports = setupPaymentRoutes;
