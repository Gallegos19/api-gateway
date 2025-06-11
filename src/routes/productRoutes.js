const { createProxyMiddleware } = require('http-proxy-middleware');
const { createServiceRateLimit } = require('../middleware/rateLimiting');
const logger = require('../utils/logger');

const setupProductRoutes = (app, serviceRegistry) => {
    const serviceName = 'product';
    
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
    
    // Middleware para validar headers de usuario directos
    const validateUserHeaders = (req, res, next) => {
        logger.info(`🔍 VALIDATE USER HEADERS:`, {
            'x-user-id': req.headers['x-user-id'],
            'x-user-role': req.headers['x-user-role'],
            'x-user-email': req.headers['x-user-email'],
            method: req.method,
            path: req.path,
            requestId: req.requestId
        });

        // Si tiene headers de usuario, crear el objeto req.user
        if (req.headers['x-user-id'] && req.headers['x-user-role']) {
            req.user = {
                userId: req.headers['x-user-id'],
                email: req.headers['x-user-email'] || 'unknown@email.com',
                profile: req.headers['x-user-role'],
                role: req.headers['x-user-role']
            };
            
            logger.info(`✅ USER CREATED:`, {
                userId: req.user.userId,
                email: req.user.email,
                role: req.user.role,
                requestId: req.requestId
            });
            
            return next();
        }
        
        logger.warn(`❌ USER HEADERS MISSING`);
        
        return res.status(401).json({
            success: false,
            error: 'Headers de usuario requeridos',
            code: 'USER_HEADERS_MISSING',
            required: ['x-user-id', 'x-user-role'],
            timestamp: new Date().toISOString()
        });
    };

    // Middleware para verificar rol de admin
    const requireAdminRole = (req, res, next) => {
        if (!req.user || req.user.role !== 'admin') {
            logger.warn(`🚫 ADMIN REQUIRED - Acceso denegado:`, {
                userRole: req.user?.role,
                userId: req.user?.userId,
                requestId: req.requestId
            });
            
            return res.status(403).json({
                success: false,
                error: 'Se requieren permisos de administrador',
                code: 'ADMIN_REQUIRED',
                userRole: req.user?.role,
                timestamp: new Date().toISOString()
            });
        }

        logger.info(`✅ ADMIN VERIFIED`);
        next();
    };

    // 🔧 PROXY ESPECIAL PARA MÉTODOS CON BODY (POST/PUT) - VERSIÓN CORREGIDA
    const createBodyProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: serviceUrl,
            changeOrigin: true,
            pathRewrite,
            timeout: 30000,
            
            // 🚨 CONFIGURACIÓN CRÍTICA PARA BODY PARSING
            selfHandleResponse: false, // Dejar que el proxy maneje la respuesta normalmente
            
            onProxyReq: (proxyReq, req, res) => {
                logger.info(`🔀 BODY PROXY: ${req.method} ${req.url} -> ${proxyReq.path}`, {
                    method: req.method,
                    proxyPath: proxyReq.path,
                    hasBody: !!req.body,
                    contentType: req.headers['content-type'],
                    contentLength: req.headers['content-length'],
                    requestId: req.requestId
                });

                // 🔧 MANEJAR BODY MANUALMENTE PARA POST/PUT
                if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && req.body) {
                    try {
                        const bodyData = JSON.stringify(req.body);
                        
                        logger.info(`📦 WRITING BODY MANUALLY:`, {
                            bodySize: bodyData.length,
                            bodyPreview: bodyData.substring(0, 100),
                            contentType: 'application/json'
                        });

                        // Establecer headers correctos
                        proxyReq.setHeader('Content-Type', 'application/json');
                        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData, 'utf8'));
                        
                        // 🚨 FIX CRÍTICO: Terminar el stream correctamente
                        proxyReq.end(bodyData);
                        
                    } catch (error) {
                        logger.error(`❌ ERROR WRITING BODY: ${error.message}`, {
                            error: error.message,
                            stack: error.stack,
                            requestId: req.requestId
                        });
                    }
                }
            },
            
            onProxyRes: (proxyRes, req, res) => {
                const statusCode = proxyRes.statusCode;
                const contentType = proxyRes.headers['content-type'];
                const contentLength = proxyRes.headers['content-length'];
                const isSuccess = statusCode >= 200 && statusCode < 400;
                
                logger.info(`${isSuccess ? '✅' : '⚠️'} BODY PROXY RESPONSE: ${statusCode}`, {
                    statusCode,
                    statusMessage: proxyRes.statusMessage,
                    method: req.method,
                    url: req.url,
                    contentType,
                    contentLength,
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
                logger.error(`❌ BODY PROXY ERROR CRÍTICO: ${err.message}`, {
                    error: err.message,
                    code: err.code,
                    errno: err.errno,
                    syscall: err.syscall,
                    method: req.method,
                    url: req.url,
                    target: serviceUrl,
                    requestId: req.requestId,
                    stack: err.stack
                });
                
                serviceRegistry.markServiceUnhealthy && serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    logger.info(`📤 ENVIANDO ERROR RESPONSE AL CLIENTE`);
                    res.status(503).json({
                        success: false,
                        error: 'Servicio de productos no disponible',
                        code: err.code || 'PROXY_ERROR',
                        message: err.message,
                        target: serviceUrl,
                        timestamp: new Date().toISOString(),
                        requestId: req.requestId
                    });
                } else {
                    logger.warn(`⚠️ NO SE PUEDE ENVIAR ERROR - Headers ya enviados`);
                }
            }
        });
    };

    // Proxy normal para métodos sin body (GET/DELETE)
    const createNormalProxy = (pathRewrite = {}) => {
        return createProxyMiddleware({
            target: serviceUrl,
            changeOrigin: true,
            pathRewrite,
            timeout: 30000,
            
            onProxyReq: (proxyReq, req, res) => {
                logger.info(`🔀 NORMAL PROXY: ${req.method} ${req.url} -> ${proxyReq.path}`, {
                    method: req.method,
                    proxyPath: proxyReq.path,
                    requestId: req.requestId
                });
            },
            
            onProxyRes: (proxyRes, req, res) => {
                logger.info(`✅ NORMAL PROXY RESPONSE: ${proxyRes.statusCode}`, {
                    statusCode: proxyRes.statusCode,
                    method: req.method,
                    requestId: req.requestId
                });
                
                if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 400) {
                    serviceRegistry.markServiceHealthy && serviceRegistry.markServiceHealthy(serviceName);
                }
            },
            
            onError: (err, req, res) => {
                logger.error(`❌ NORMAL PROXY ERROR: ${err.message}`);
                serviceRegistry.markServiceUnhealthy && serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                if (!res.headersSent) {
                    res.status(503).json({
                        success: false,
                        error: 'Servicio no disponible',
                        message: err.message,
                        requestId: req.requestId
                    });
                }
            }
        });
    };
    
    // 🔓 RUTAS PÚBLICAS (GET - sin body)
    app.get('/api/products', 
        createServiceRateLimit('products'),
        createNormalProxy({ '^/api/products': '/api/products' })
    );

    app.get('/api/products/:id', 
        createServiceRateLimit('products'),
        createNormalProxy({ '^/api/products/([^/]+)$': '/api/products/$1' })
    );

    // Búsqueda de productos (público)
    app.get('/api/products/search/:term',
        createServiceRateLimit('products'),
        createNormalProxy({ '^/api/products/search/([^/]+)$': '/api/products/search/$1' })
    );

    // Productos por categoría (público)
    app.get('/api/products/category/:category',
        createServiceRateLimit('products'),
        createNormalProxy({ '^/api/products/category/([^/]+)$': '/api/products/category/$1' })
    );

    // 🔒 POST PRODUCT (con body) - RUTA CORREGIDA
    app.post('/api/products', 
        validateUserHeaders,
        requireAdminRole,
        createServiceRateLimit('products'),
        (req, res, next) => {
            logger.info(`📦 POST READY:`, {
                hasBody: !!req.body,
                bodyKeys: req.body ? Object.keys(req.body) : [],
                bodySize: req.body ? JSON.stringify(req.body).length : 0,
                user: req.user.role,
                requestId: req.requestId
            });
            next();
        },
        createBodyProxy({ '^/api/products$': '/api/products' })
    );

    // 🔒 PUT PRODUCT (con body)
    app.put('/api/products/:id', 
        validateUserHeaders,
        requireAdminRole,
        createServiceRateLimit('products'),
        (req, res, next) => {
            logger.info(`📦 PUT READY:`, {
                productId: req.params.id,
                hasBody: !!req.body,
                bodyKeys: req.body ? Object.keys(req.body) : [],
                user: req.user.role,
                requestId: req.requestId
            });
            next();
        },
        createBodyProxy({ '^/api/products/([^/]+)$': '/api/products/$1' })
    );

    // 🔒 DELETE PRODUCT (sin body)
    app.delete('/api/products/:id', 
        validateUserHeaders,
        requireAdminRole,
        createServiceRateLimit('products'),
        createNormalProxy({ '^/api/products/([^/]+)$': '/api/products/$1' })
    );

    // 🔒 Rutas específicas de administración
    app.get('/api/admin/products',
        validateUserHeaders,
        requireAdminRole,
        createServiceRateLimit('products'),
        createNormalProxy({ '^/api/admin/products': '/api/admin/products' })
    );

    app.get('/api/admin/products/stats',
        validateUserHeaders,
        requireAdminRole,
        createServiceRateLimit('products'),
        createNormalProxy({ '^/api/admin/products/stats': '/api/admin/products/stats' })
    );

    app.put('/api/admin/products/:id/stock',
        validateUserHeaders,
        requireAdminRole,
        createServiceRateLimit('products'),
        createBodyProxy({ '^/api/admin/products/([^/]+)/stock$': '/api/admin/products/$1/stock' })
    );

    logger.info(`✅ Product routes configuradas completamente - Proxy especial para body: ${serviceUrl}`);
};

module.exports = setupProductRoutes;