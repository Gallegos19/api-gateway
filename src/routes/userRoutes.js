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
    
    // 🔧 SOLUCIÓN: Resolver URL de servicio de forma síncrona antes del proxy
    const getUserServiceUrl = () => {
        try {
            const service = serviceRegistry.getService(serviceName);
            if (!service) {
                logger.error(`Servicio ${serviceName} no encontrado en registry`);
                throw new Error(`Servicio ${serviceName} no encontrado`);
            }
            
            // Usar directamente la URL del servicio configurado
            const serviceUrl = service.url;
            logger.debug(`URL del servicio ${serviceName}: ${serviceUrl}`);
            
            if (!serviceUrl || typeof serviceUrl !== 'string') {
                logger.error(`URL inválida para servicio ${serviceName}: ${serviceUrl}`);
                throw new Error(`URL inválida para servicio ${serviceName}`);
            }
            
            return serviceUrl;
        } catch (error) {
            logger.error(`Error obteniendo URL de ${serviceName}: ${error.message}`);
            throw error;
        }
    };
    
    // Verificar que el servicio esté disponible al inicio
    try {
        const testUrl = getUserServiceUrl();
        logger.info(`✅ Servicio ${serviceName} configurado en: ${testUrl}`);
    } catch (error) {
        logger.error(`❌ No se pudo configurar el servicio ${serviceName}: ${error.message}`);
        return; // No configurar rutas si el servicio no está disponible
    }
    
    // 🔧 Crear proxy simplificado con URL fija
    const createUserProxy = (pathRewrite = {}) => {
        const serviceUrl = getUserServiceUrl(); // Obtener URL una vez
        
        return createProxyMiddleware({
            target: serviceUrl, // URL fija, no función
            changeOrigin: true,
            pathRewrite,
            timeout: 30000,
            logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
            
            onProxyReq: (proxyReq, req, res) => {
                logger.debug(`🔀 Proxy request: ${req.method} ${req.url} -> ${serviceUrl}`, {
                    target: serviceUrl,
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id']
                });

                // Asegurar headers correctos
                if (req.body && typeof req.body === 'object') {
                    const bodyData = JSON.stringify(req.body);
                    proxyReq.setHeader('Content-Type', 'application/json');
                    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                    proxyReq.write(bodyData);
                }
            },
            
            onProxyRes: (proxyRes, req, res) => {
                logger.debug(`✅ Proxy response: ${proxyRes.statusCode} from ${serviceUrl}`, {
                    method: req.method,
                    url: req.url,
                    statusCode: proxyRes.statusCode,
                    userId: req.headers['x-user-id']
                });

                // Marcar servicio como saludable en respuestas exitosas
                if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 400) {
                    serviceRegistry.markServiceHealthy(serviceName);
                }
            },
            
            onError: (err, req, res) => {
                logger.error(`❌ Proxy error para ${serviceName}:`, {
                    error: err.message,
                    code: err.code,
                    method: req.method,
                    url: req.url,
                    target: serviceUrl,
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id']
                });
                
                // Marcar servicio como no saludable
                serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                // Enviar respuesta de error si no se ha enviado ya
                if (!res.headersSent) {
                    const statusCode = getErrorStatusCode(err);
                    const errorResponse = {
                        success: false,
                        error: 'Servicio de usuarios temporalmente no disponible',
                        code: 'USER_SERVICE_UNAVAILABLE',
                        message: getErrorMessage(err),
                        timestamp: new Date().toISOString(),
                        requestId: req.headers['x-request-id']
                    };

                    // En desarrollo, incluir más detalles
                    if (process.env.NODE_ENV === 'development') {
                        errorResponse.details = {
                            originalError: err.message,
                            code: err.code,
                            target: serviceUrl,
                            serviceName
                        };
                    }

                    res.status(statusCode).json(errorResponse);
                }
            }
        });
    };

    // 🔓 Rutas públicas de autenticación
    logger.info(`🔧 Configurando rutas de autenticación para ${serviceName}...`);

    app.post('/api/auth/register', 
        handleAuthRoutes,
        createServiceRateLimit('auth'),
        (req, res, next) => {
            logger.info('📝 Procesando registro de usuario', {
                email: req.body?.email,
                requestId: req.headers['x-request-id']
            });
            next();
        },
        createUserProxy({ '^/api/auth/register': '/api/users/register' })
    );

    app.post('/api/auth/login', 
        handleAuthRoutes,
        createServiceRateLimit('auth'),
        (req, res, next) => {
            logger.info('🔑 Procesando login de usuario', {
                email: req.body?.email,
                requestId: req.headers['x-request-id']
            });
            next();
        },
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

    app.post('/api/auth/refresh',
        handleAuthRoutes,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/auth/refresh': '/api/users/refresh' })
    );

    // 🔒 Rutas protegidas de usuario
    logger.info(`🔧 Configurando rutas protegidas para ${serviceName}...`);

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

    app.delete('/api/users/profile',
        ...protectedRoute,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/users/profile': '/api/users/profile' })
    );

    // 🔒 Rutas de administración de usuarios
    logger.info(`🔧 Configurando rutas de admin para ${serviceName}...`);

    app.get('/api/admin/users',
        ...adminRoute,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/admin/users': '/api/users/admin' })
    );

    app.get('/api/admin/users/:userId',
        ...adminRoute,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/admin/users': '/api/users/admin' })
    );

    app.put('/api/admin/users/:userId',
        ...adminRoute,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/admin/users': '/api/users/admin' })
    );

    app.delete('/api/admin/users/:userId',
        ...adminRoute,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/admin/users': '/api/users/admin' })
    );

    app.get('/api/admin/users/stats',
        ...adminRoute,
        createServiceRateLimit('auth'),
        createUserProxy({ '^/api/admin/users': '/api/users/admin' })
    );

    logger.info(`✅ User routes configuradas completamente para ${serviceName}`);
};

// Funciones auxiliares para manejo de errores
function getErrorStatusCode(err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return 503; // Service Unavailable
    }
    if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
        return 504; // Gateway Timeout
    }
    if (err.code === 'ECONNRESET') {
        return 502; // Bad Gateway
    }
    return 503; // Service Unavailable por defecto
}

function getErrorMessage(err) {
    if (err.code === 'ECONNREFUSED') {
        return 'No se pudo conectar con el servicio de usuarios. Verifica que esté ejecutándose.';
    }
    if (err.code === 'ENOTFOUND') {
        return 'Servicio de usuarios no encontrado. Verifica la configuración de URL.';
    }
    if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
        return 'Tiempo de espera agotado conectando con el servicio de usuarios.';
    }
    if (err.code === 'ECONNRESET') {
        return 'Conexión con el servicio de usuarios fue reiniciada inesperadamente.';
    }
    return 'Error de comunicación con el servicio de usuarios.';
}

module.exports = setupUserRoutes;