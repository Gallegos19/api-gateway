const { createProxyMiddleware } = require('http-proxy-middleware');
const { protectedRoute, adminRoute } = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupPaymentRoutes = (app, serviceRegistry) => {
    const serviceName = 'payment';
    
    const createPaymentProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: () => serviceRegistry.getServiceInstance(serviceName),
            changeOrigin: true,
            pathRewrite,
            timeout: 60000, // Timeout muy largo para pagos
            retries: 0, // Sin reintentos para evitar doble cobro
            
            onProxyReq: (proxyReq, req, res) => {
                // Headers especiales para pagos
                if (req.headers['x-idempotency-key']) {
                    proxyReq.setHeader('x-idempotency-key', req.headers['x-idempotency-key']);
                }
                
                logger.info(`PAYMENT: Proxy request to payment-service: ${req.method} ${req.url}`, {
                    target: proxyReq.getHeader('host'),
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id'],
                    idempotencyKey: req.headers['x-idempotency-key']
                });
            },
            
            onProxyRes: (proxyRes, req, res) => {
                logger.info(`PAYMENT: Proxy response from payment-service: ${proxyRes.statusCode}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id'],
                    statusCode: proxyRes.statusCode
                });
            },
            
            onError: (err, req, res) => {
                logger.error(`PAYMENT ERROR: Error en payment-service proxy: ${err.message}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id'],
                    error: err.message,
                    stack: err.stack
                });
                
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        success: false,
                        error: 'Servicio de pagos no disponible',
                        code: 'PAYMENT_SERVICE_UNAVAILABLE',
                        advice: 'Verifica el estado de tu pago antes de reintentar',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    };

    // 🔒 Rutas de pagos para usuarios
    app.post('/api/payments/process', 
        ...protectedRoute,
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/payments': '/api/payments' })
    );

    app.get('/api/payments/:id', 
        ...protectedRoute,
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/payments': '/api/payments' })
    );

    app.get('/api/payments', 
        ...protectedRoute,
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/payments': '/api/payments' })
    );

    app.post('/api/payments/:id/cancel',
        ...protectedRoute,
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/payments': '/api/payments' })
    );

    // 🔒 Rutas de administración de pagos
    app.get('/api/admin/payments', 
        ...adminRoute,
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/admin/payments': '/api/admin/payments' })
    );

    app.post('/api/admin/payments/:id/refund', 
        ...adminRoute,
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/admin/payments': '/api/admin/payments' })
    );

    app.get('/api/admin/payments/stats',
        ...adminRoute,
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/admin/payments': '/api/admin/payments' })
    );

    app.get('/api/admin/payments/transactions',
        ...adminRoute,
        createServiceRateLimit('payments'),
        createPaymentProxy({ '^/api/admin/payments': '/api/admin/payments' })
    );

    // 🔒 Webhooks de proveedores de pago (requieren validación especial)
    app.post('/api/payments/webhook/stripe',
        // Aquí normalmente validarías el webhook de Stripe
        createPaymentProxy({ '^/api/payments': '/api/payments' })
    );

    app.post('/api/payments/webhook/paypal',
        // Aquí normalmente validarías el webhook de PayPal
        createPaymentProxy({ '^/api/payments': '/api/payments' })
    );

    logger.info('✅ Payment routes configuradas completamente');
};

module.exports = setupPaymentRoutes;