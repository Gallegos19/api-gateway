const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const requestLogger = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    const startTime = Date.now();
    
    // Agregar request ID a los headers
    req.requestId = requestId;
    
    // 🔧 CORRECCIÓN: Solo establecer header si aún no se han enviado
    try {
        if (!res.headersSent) {
            res.setHeader('X-Request-ID', requestId);
        }
    } catch (error) {
        // Ignorar si ya se enviaron headers
        logger.debug('No se pudo establecer X-Request-ID header', { error: error.message });
    }
    
    // Log de request entrante
    logger.info('Request iniciado', {
        requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        timestamp: new Date().toISOString()
    });

    // Bandera para evitar multiple llamadas
    let responseLogged = false;

    // Override del método end para capturar la respuesta
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        if (!responseLogged) {
            responseLogged = true;
            const responseTime = Date.now() - startTime;
            
            // Log de respuesta
            logger.info('Request completado', {
                requestId,
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                responseTime: `${responseTime}ms`,
                contentLength: res.get('Content-Length'),
                userId: req.user?.id
            });
            
            // 🔧 CORRECCIÓN: Solo establecer header si aún no se han enviado
            try {
                if (!res.headersSent) {
                    res.setHeader('X-Response-Time', `${responseTime}ms`);
                }
            } catch (error) {
                // Ignorar si ya se enviaron headers - esto es normal con proxies
                logger.debug('No se pudo establecer X-Response-Time header', { 
                    error: error.message,
                    requestId 
                });
            }
        }
        
        // Llamar al método original
        originalEnd.call(this, chunk, encoding);
    };

    // También capturar si se llama a res.send, res.json, etc.
    const originalSend = res.send;
    res.send = function(data) {
        if (!responseLogged) {
            responseLogged = true;
            const responseTime = Date.now() - startTime;
            
            logger.info('Request completado (send)', {
                requestId,
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                responseTime: `${responseTime}ms`,
                userId: req.user?.id
            });
            
            try {
                if (!res.headersSent) {
                    res.setHeader('X-Response-Time', `${responseTime}ms`);
                }
            } catch (error) {
                logger.debug('No se pudo establecer X-Response-Time header en send', { 
                    error: error.message,
                    requestId 
                });
            }
        }
        
        return originalSend.call(this, data);
    };

    // Capturar errores en la respuesta
    res.on('error', (error) => {
        if (!responseLogged) {
            responseLogged = true;
            const responseTime = Date.now() - startTime;
            
            logger.error('Error en respuesta', {
                requestId,
                method: req.method,
                url: req.originalUrl,
                error: error.message,
                responseTime: `${responseTime}ms`,
                userId: req.user?.id
            });
        }
    });

    next();
};

module.exports = { requestLogger };