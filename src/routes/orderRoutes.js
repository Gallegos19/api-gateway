const { createProxyMiddleware } = require('http-proxy-middleware');
const { protectedRoute, adminRoute } = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupOrderRoutes = (app, serviceRegistry) => {
    const serviceName = 'order';
    
    logger.info(`🔧 Configurando rutas para ${serviceName}...`);
    
    // Obtener servicio y validar
    const service = serviceRegistry.getService(serviceName);
    if (!service) {
        logger.error(`❌ Servicio ${serviceName} no encontrado en registry`);
        return;
    }
    
    const serviceUrl = service.url;
    if (!serviceUrl) {
        logger.error(`❌ URL no configurada para servicio ${serviceName}`);
        return;
    }
    
    logger.info(`🔗 Configurando proxy para ${serviceName}: ${serviceUrl}`);
    
    const createOrderProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: serviceUrl, // 🔧 FIX: Usar URL fija en lugar de función
            changeOrigin: true,
            pathRewrite,
            timeout: 45000, // Timeout más largo para órdenes
            
            onProxyReq: (proxyReq, req, res) => {
                logger.debug(`🔀 Order Proxy request: ${req.method} ${req.url} -> ${proxyReq.path}`, {
                    target: serviceUrl,
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id'],
                    proxyPath: proxyReq.path
                });

                // 🔧 Manejar body para métodos POST/PUT/PATCH
                if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && req.body) {
                    try {
                        const bodyData = JSON.stringify(req.body);
                        
                        logger.info(`📦 Order - Writing body:`, {
                            bodySize: bodyData.length,
                            bodyKeys: Object.keys(req.body),
                            method: req.method,
                            hasShippingAddress: !!req.body.shippingAddress,
                            paymentMethod: req.body.paymentMethod,
                            requestId: req.requestId
                        });

                        proxyReq.setHeader('Content-Type', 'application/json');
                        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData, 'utf8'));
                        proxyReq.end(bodyData); // 🚨 FIX: Usar end() en lugar de write()
                        
                    } catch (error) {
                        logger.error(`❌ Order - Error writing body: ${error.message}`, {
                            error: error.message,
                            requestId: req.requestId
                        });
                    }
                }
            },
            
            onProxyRes: (proxyRes, req, res) => {
                const statusCode = proxyRes.statusCode;
                const isSuccess = statusCode >= 200 && statusCode < 400;
                
                logger.debug(`${isSuccess ? '✅' : '⚠️'} Order Proxy response: ${statusCode}`, {
                    method: req.method,
                    url: req.url,
                    statusCode,
                    statusMessage: proxyRes.statusMessage,
                    userId: req.headers['x-user-id'],
                    requestId: req.requestId
                });

                if (isSuccess) {
                    serviceRegistry.markServiceHealthy && serviceRegistry.markServiceHealthy(serviceName);
                } else if (statusCode >= 500) {
                    const error = new Error(`HTTP ${statusCode} from ${serviceName}`);
                    serviceRegistry.markServiceUnhealthy && serviceRegistry.markServiceUnhealthy(serviceName, error);
                }
            },
            
            onError: (err, req, res) => {
                logger.error(`❌ Order Proxy error: ${err.message}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id'],
                    error: err.message,
                    code: err.code,
                    target: serviceUrl,
                    requestId: req.requestId,
                    stack: err.stack
                });
                
                serviceRegistry.markServiceUnhealthy && serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        success: false,
                        error: 'Servicio de pedidos no disponible',
                        code: 'ORDER_SERVICE_UNAVAILABLE',
                        details: err.message,
                        target: serviceUrl,
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    });
                }
            }
        });
    };

    // 🔒 Rutas de órdenes para usuarios autenticados
    app.get('/api/orders', 
        ...protectedRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders$': '/api/orders' })
    );

    app.post('/api/orders', 
        ...protectedRoute,
        createServiceRateLimit('orders'),
        (req, res, next) => {
            logger.info(`📦 Order POST ready:`, {
                hasBody: !!req.body,
                bodyKeys: req.body ? Object.keys(req.body) : [],
                hasShippingAddress: !!(req.body && req.body.shippingAddress),
                paymentMethod: req.body?.paymentMethod,
                userId: req.user?.userId,
                requestId: req.requestId
            });
            next();
        },
        createOrderProxy({ '^/api/orders$': '/api/orders' })
    );

    app.get('/api/orders/:id', 
        ...protectedRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders/(.+)$': '/api/orders/$1' })
    );

    app.put('/api/orders/:id/cancel', 
        ...protectedRoute,
        createServiceRateLimit('orders'),
        (req, res, next) => {
            logger.info(`📦 Order CANCEL ready:`, {
                orderId: req.params.id,
                hasBody: !!req.body,
                userId: req.user?.userId,
                requestId: req.requestId
            });
            next();
        },
        createOrderProxy({ '^/api/orders/(.+)/cancel$': '/api/orders/$1/cancel' })
    );

    // 🔒 Rutas de administración de órdenes
    app.get('/api/orders', 
        ...adminRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders$': '/api/orders' })
    );

    app.patch('/api/orders/:id/status', 
        ...adminRoute,
        createServiceRateLimit('orders'),
        (req, res, next) => {
            logger.info(`📦 Admin Order STATUS UPDATE ready:`, {
                orderId: req.params.id,
                hasBody: !!req.body,
                newStatus: req.body?.status,
                userId: req.user?.userId,
                requestId: req.requestId
            });
            next();
        },
        createOrderProxy({ '^/api/orders/(.+)/status$': '/api/orders/$1/status' })
    );

    app.get('/api/orders/stats',
        ...adminRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders/stats$': '/api/orders/stats' })
    );

    app.patch('/api/orders/:id/ship',
        ...adminRoute,
        createServiceRateLimit('orders'),
        (req, res, next) => {
            logger.info(`📦 Admin Order SHIP ready:`, {
                orderId: req.params.id,
                hasBody: !!req.body,
                trackingInfo: req.body?.trackingNumber,
                userId: req.user?.userId,
                requestId: req.requestId
            });
            next();
        },
        createOrderProxy({ '^/api/orders/(.+)/ship$': '/api/orders/$1/ship' })
    );

    // Rutas adicionales para manejo de órdenes
    app.get('/api/orders/pending',
        ...adminRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders/pending$': '/api/orders/pending' })
    );

    app.get('/api/orders/fulfilled',
        ...adminRoute,
        createServiceRateLimit('orders'),
        createOrderProxy({ '^/api/orders/fulfilled$': '/api/orders/fulfilled' })
    );

    app.patch('/api/orders/:id/cancel',
        ...adminRoute,
        createServiceRateLimit('orders'),
        (req, res, next) => {
            logger.info(`📦 Admin Order CANCEL ready:`, {
                orderId: req.params.id,
                hasBody: !!req.body,
                userId: req.user?.userId,
                requestId: req.requestId
            });
            next();
        },
        createOrderProxy({ '^/api/orders/(.+)/cancel$': '/api/orders/$1/cancel' })
    );

    app.put('/api/orders/:id/refund',
        ...adminRoute,
        createServiceRateLimit('orders'),
        (req, res, next) => {
            logger.info(`📦 Admin Order REFUND ready:`, {
                orderId: req.params.id,
                hasBody: !!req.body,
                refundAmount: req.body?.amount,
                reason: req.body?.reason,
                userId: req.user?.userId,
                requestId: req.requestId
            });
            next();
        },
        createOrderProxy({ '^/api/orders/(.+)/refund$': '/api/orders/$1/refund' })
    );

    logger.info(`✅ Order routes configuradas completamente - Target: ${serviceUrl}`);
};

module.exports = setupOrderRoutes;