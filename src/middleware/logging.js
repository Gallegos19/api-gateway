const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const requestLogger = (req, res, next) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    const startTime = Date.now();
    
    // Agregar request ID a los headers
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    
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

    // Override del método end para capturar la respuesta
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
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
        
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        originalEnd.call(this, chunk, encoding);
    };

    next();
};

module.exports = { requestLogger }