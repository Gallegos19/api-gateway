const { createProxyMiddleware } = require('http-proxy-middleware');
const { protectedRoute, adminRoute } = require('../middleware/auth');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupCartRoutes = (app, serviceRegistry) => {
    const serviceName = 'cart';
    
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
    
    // Proxy con target fijo en lugar de función
    const createCartProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: serviceUrl, // 🔧 FIX: Usar URL fija en lugar de función
            changeOrigin: true,
            pathRewrite,
            timeout: 30000,
            
            onProxyReq: (proxyReq, req, res) => {
                logger.debug(`🔀 Cart Proxy request: ${req.method} ${req.url} -> ${proxyReq.path}`, {
                    target: serviceUrl,
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id'],
                    proxyPath: proxyReq.path
                });

                // 🔧 Manejar body para métodos POST/PUT
                if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && req.body) {
                    try {
                        const bodyData = JSON.stringify(req.body);
                        
                        logger.info(`📦 Cart - Writing body:`, {
                            bodySize: bodyData.length,
                            bodyKeys: Object.keys(req.body),
                            method: req.method,
                            requestId: req.requestId
                        });

                        proxyReq.setHeader('Content-Type', 'application/json');
                        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData, 'utf8'));
                        proxyReq.end(bodyData); // 🚨 FIX: Usar end() en lugar de write()
                        
                    } catch (error) {
                        logger.error(`❌ Cart - Error writing body: ${error.message}`, {
                            error: error.message,
                            requestId: req.requestId
                        });
                    }
                }
            },
            
            onProxyRes: (proxyRes, req, res) => {
                const statusCode = proxyRes.statusCode;
                const isSuccess = statusCode >= 200 && statusCode < 400;
                
                logger.debug(`${isSuccess ? '✅' : '⚠️'} Cart Proxy response: ${statusCode}`, {
                    method: req.method,
                    url: req.url,
                    statusCode,
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
                logger.error(`❌ Cart Proxy error: ${err.message}`, {
                    method: req.method,
                    url: req.url,
                    userId: req.headers['x-user-id'],
                    error: err.message,
                    code: err.code,
                    target: serviceUrl,
                    requestId: req.requestId
                });
                
                serviceRegistry.markServiceUnhealthy && serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        success: false,
                        error: 'Servicio de carrito no disponible',
                        code: 'CART_SERVICE_UNAVAILABLE',
                        details: err.message,
                        target: serviceUrl,
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    });
                }
            }
        });
    };

    // 🔒 Todas las rutas de carrito requieren autenticación
    app.get('/api/cart', 
        ...protectedRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart$': '/api/cart' })
    );

    app.post('/api/cart/items', 
        ...protectedRoute,
        createServiceRateLimit('cart'),
        (req, res, next) => {
            logger.info(`📦 Cart POST /items ready:`, {
                hasBody: !!req.body,
                bodyKeys: req.body ? Object.keys(req.body) : [],
                userId: req.user?.userId,
                requestId: req.requestId
            });
            next();
        },
        createCartProxy({ '^/api/cart/items$': '/api/cart/items' })
    );

    app.put('/api/cart/items/:itemId', 
        ...protectedRoute,
        createServiceRateLimit('cart'),
        (req, res, next) => {
            logger.info(`📦 Cart PUT /items/${req.params.itemId} ready:`, {
                itemId: req.params.itemId,
                hasBody: !!req.body,
                bodyKeys: req.body ? Object.keys(req.body) : [],
                userId: req.user?.userId,
                requestId: req.requestId
            });
            next();
        },
        createCartProxy({ '^/api/cart/items/(.+)$': '/api/cart/items/$1' })
    );

    app.delete('/api/cart/items/:itemId', 
        ...protectedRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart/items/(.+)$': '/api/cart/items/$1' })
    );

    app.delete('/api/cart', 
        ...protectedRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/cart$': '/api/cart' })
    );

    // 🔒 Rutas de administración de carritos
    app.get('/api/admin/carts',
        ...adminRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/admin/carts$': '/api/admin/carts' })
    );

    app.get('/api/admin/carts/abandoned',
        ...adminRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/admin/carts/abandoned$': '/api/admin/carts/abandoned' })
    );

    // Estadísticas de carritos (admin)
    app.get('/api/admin/carts/stats',
        ...adminRoute,
        createServiceRateLimit('cart'),
        createCartProxy({ '^/api/admin/carts/stats$': '/api/admin/carts/stats' })
    );

    logger.info(`✅ Cart routes configuradas completamente - Target: ${serviceUrl}`);
};

module.exports = setupCartRoutes;