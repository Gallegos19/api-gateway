const { createProxyMiddleware } = require('http-proxy-middleware');
const logger = require('./logger');

/**
 * Fábrica centralizada para crear proxies
 * Soluciona el problema de URLs undefined de forma consistente
 */
class ProxyFactory {
    constructor(serviceRegistry) {
        this.serviceRegistry = serviceRegistry;
    }

    /**
     * Crear un proxy middleware para un servicio específico
     * @param {string} serviceName - Nombre del servicio
     * @param {Object} options - Opciones adicionales para el proxy
     * @returns {Function} Middleware de proxy
     */
    createProxy(serviceName, options = {}) {
        const {
            pathRewrite = {},
            timeout = 30000,
            logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
        } = options;

        // 🔧 SOLUCIÓN: Obtener URL del servicio de forma segura
        const getServiceUrl = () => {
            try {
                const service = this.serviceRegistry.getService(serviceName);
                if (!service) {
                    const error = new Error(`Servicio ${serviceName} no encontrado en registry`);
                    error.code = 'SERVICE_NOT_FOUND';
                    throw error;
                }
                
                const serviceUrl = service.url;
                if (!serviceUrl || typeof serviceUrl !== 'string' || !serviceUrl.trim()) {
                    const error = new Error(`URL inválida para servicio ${serviceName}: ${serviceUrl}`);
                    error.code = 'INVALID_SERVICE_URL';
                    throw error;
                }
                
                // Validar formato de URL
                try {
                    new URL(serviceUrl);
                } catch (urlError) {
                    const error = new Error(`URL malformada para servicio ${serviceName}: ${serviceUrl}`);
                    error.code = 'MALFORMED_URL';
                    throw error;
                }
                
                logger.debug(`✅ URL válida para ${serviceName}: ${serviceUrl}`);
                return serviceUrl;
                
            } catch (error) {
                logger.error(`❌ Error obteniendo URL de ${serviceName}: ${error.message}`, {
                    serviceName,
                    error: error.message,
                    code: error.code
                });
                throw error;
            }
        };

        // Verificar que el servicio esté disponible al crear el proxy
        let serviceUrl;
        try {
            serviceUrl = getServiceUrl();
            logger.info(`🔗 Proxy creado para ${serviceName}: ${serviceUrl}`);
        } catch (error) {
            logger.error(`❌ No se puede crear proxy para ${serviceName}: ${error.message}`);
            
            // Retornar middleware que siempre falla
            return (req, res, next) => {
                const errorResponse = {
                    success: false,
                    error: `Servicio ${serviceName} no configurado correctamente`,
                    code: 'SERVICE_CONFIGURATION_ERROR',
                    message: error.message,
                    timestamp: new Date().toISOString(),
                    requestId: req.headers['x-request-id']
                };

                if (process.env.NODE_ENV === 'development') {
                    errorResponse.details = {
                        serviceName,
                        configurationError: error.message,
                        code: error.code
                    };
                }

                res.status(503).json(errorResponse);
            };
        }

        // Crear el proxy con URL fija
        return createProxyMiddleware({
            target: serviceUrl, // URL fija obtenida de forma segura
            changeOrigin: true,
            pathRewrite,
            timeout,
            logLevel,
            
            onProxyReq: (proxyReq, req, res) => {
                logger.debug(`🔀 Proxy request [${serviceName}]: ${req.method} ${req.url} -> ${serviceUrl}`, {
                    serviceName,
                    target: serviceUrl,
                    method: req.method,
                    path: req.url,
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id']
                });

                // Solo agregar headers adicionales, no manejar el body aquí
                // El body ya es manejado automáticamente por http-proxy-middleware
                try {
                    proxyReq.setHeader('X-Forwarded-For', req.ip);
                    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
                    proxyReq.setHeader('X-Forwarded-Host', req.get('host'));
                } catch (error) {
                    logger.warn(`No se pudieron establecer headers adicionales: ${error.message}`);
                }
            },
            
            onProxyRes: (proxyRes, req, res) => {
                const statusCode = proxyRes.statusCode;
                const isSuccess = statusCode >= 200 && statusCode < 400;
                
                logger.debug(`${isSuccess ? '✅' : '⚠️'} Proxy response [${serviceName}]: ${statusCode}`, {
                    serviceName,
                    method: req.method,
                    url: req.url,
                    statusCode,
                    userId: req.headers['x-user-id'],
                    contentType: proxyRes.headers['content-type']
                });

                // Actualizar estado del servicio basado en la respuesta
                if (isSuccess) {
                    this.serviceRegistry.markServiceHealthy(serviceName);
                } else if (statusCode >= 500) {
                    // Solo marcar como no saludable en errores 5xx
                    const error = new Error(`HTTP ${statusCode} from ${serviceName}`);
                    this.serviceRegistry.markServiceUnhealthy(serviceName, error);
                }

                // Headers de respuesta
                try {
                    res.setHeader('X-Served-By', serviceName);
                    res.setHeader('X-Response-Time', Date.now() - (req.startTime || Date.now()));
                } catch (error) {
                    // Headers ya enviados, ignorar
                }
            },
            
            onError: (err, req, res) => {
                logger.error(`❌ Proxy error [${serviceName}]:`, {
                    serviceName,
                    error: err.message,
                    code: err.code,
                    method: req.method,
                    url: req.url,
                    target: serviceUrl,
                    userId: req.headers['x-user-id'],
                    requestId: req.headers['x-request-id']
                });
                
                // Marcar servicio como no saludable
                this.serviceRegistry.markServiceUnhealthy(serviceName, err);
                
                // Enviar respuesta de error apropiada
                if (!res.headersSent) {
                    const statusCode = this.getErrorStatusCode(err);
                    const errorResponse = {
                        success: false,
                        error: `Servicio ${serviceName} temporalmente no disponible`,
                        code: this.getErrorCode(err, serviceName),
                        message: this.getErrorMessage(err, serviceName),
                        timestamp: new Date().toISOString(),
                        requestId: req.headers['x-request-id']
                    };

                    // En desarrollo, incluir más detalles
                    if (process.env.NODE_ENV === 'development') {
                        errorResponse.details = {
                            serviceName,
                            originalError: err.message,
                            code: err.code,
                            target: serviceUrl,
                            stack: err.stack
                        };
                    }

                    res.status(statusCode).json(errorResponse);
                }
            }
        });
    }

    /**
     * Obtener código de estado HTTP apropiado para el error
     */
    getErrorStatusCode(err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            return 503; // Service Unavailable
        }
        if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
            return 504; // Gateway Timeout
        }
        if (err.code === 'ECONNRESET') {
            return 502; // Bad Gateway
        }
        if (err.code === 'SERVICE_NOT_FOUND' || err.code === 'INVALID_SERVICE_URL') {
            return 503; // Service Unavailable
        }
        return 503; // Service Unavailable por defecto
    }

    /**
     * Obtener código de error específico
     */
    getErrorCode(err, serviceName) {
        const serviceCode = serviceName.toUpperCase().replace('-', '_');
        
        if (err.code === 'ECONNREFUSED') {
            return `${serviceCode}_CONNECTION_REFUSED`;
        }
        if (err.code === 'ENOTFOUND') {
            return `${serviceCode}_NOT_FOUND`;
        }
        if (err.code === 'ETIMEDOUT') {
            return `${serviceCode}_TIMEOUT`;
        }
        if (err.code === 'SERVICE_NOT_FOUND') {
            return `${serviceCode}_NOT_CONFIGURED`;
        }
        
        return `${serviceCode}_UNAVAILABLE`;
    }

    /**
     * Obtener mensaje de error amigable
     */
    getErrorMessage(err, serviceName) {
        const serviceFriendlyName = this.getServiceFriendlyName(serviceName);
        
        if (err.code === 'ECONNREFUSED') {
            return `No se pudo conectar con el ${serviceFriendlyName}. Verifica que esté ejecutándose.`;
        }
        if (err.code === 'ENOTFOUND') {
            return `${serviceFriendlyName} no encontrado. Verifica la configuración de URL.`;
        }
        if (err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
            return `Tiempo de espera agotado conectando con el ${serviceFriendlyName}.`;
        }
        if (err.code === 'ECONNRESET') {
            return `Conexión con el ${serviceFriendlyName} fue reiniciada inesperadamente.`;
        }
        if (err.code === 'SERVICE_NOT_FOUND') {
            return `${serviceFriendlyName} no está configurado correctamente.`;
        }
        
        return `Error de comunicación con el ${serviceFriendlyName}.`;
    }

    /**
     * Obtener nombre amigable del servicio
     */
    getServiceFriendlyName(serviceName) {
        const friendlyNames = {
            'user': 'servicio de usuarios',
            'product': 'servicio de productos',
            'cart': 'servicio de carrito',
            'order': 'servicio de pedidos',
            'payment': 'servicio de pagos',
            'email': 'servicio de email'
        };
        
        return friendlyNames[serviceName] || `servicio ${serviceName}`;
    }

    /**
     * Crear múltiples proxies para un servicio
     */
    createServiceProxies(serviceName, routes) {
        return routes.map(route => ({
            ...route,
            proxy: this.createProxy(serviceName, route.options)
        }));
    }
}

module.exports = ProxyFactory;