const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { corsMiddleware } = require('./cors');
const { globalRateLimit } = require('./rateLimiting');
const { requestLogger } = require('./logging');
const { errorHandler } = require('./errorHandler');
const logger = require('../utils/logger');

const setupMiddleware = (app) => {
    // 1. Seguridad (debe ir primero)
    app.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    }));
    
    // 2. CORS (antes del parsing)
    app.use(corsMiddleware);
    
    // 3. Request logging y tracking (antes del parsing)
    app.use(requestLogger);
    
    // 🔍 4. DEBUGGING: Middleware para verificar raw body
    app.use((req, res, next) => {
        if (req.method === 'POST' || req.method === 'PUT') {
            logger.debug(`📦 RAW REQUEST antes del parsing:`, {
                method: req.method,
                url: req.url,
                headers: {
                    'content-type': req.headers['content-type'],
                    'content-length': req.headers['content-length']
                },
                hasRawBody: !!req.body,
                requestId: req.headers['x-request-id']
            });
        }
        next();
    });
    
    // 5. Parsing del body (CRÍTICO)
    app.use(express.json({ 
        limit: '10mb',
        verify: (req, res, buf, encoding) => {
            // 🔍 DEBUGGING: Log del buffer recibido
            if (buf && buf.length > 0) {
                logger.debug(`📥 Buffer recibido:`, {
                    length: buf.length,
                    encoding,
                    preview: buf.toString().substring(0, 100),
                    method: req.method,
                    url: req.url
                });
            }
            
            // Verificar que el JSON sea válido
            try {
                if (buf && buf.length > 0) {
                    JSON.parse(buf);
                }
            } catch (error) {
                logger.error(`❌ JSON inválido:`, {
                    error: error.message,
                    buffer: buf.toString(),
                    method: req.method,
                    url: req.url
                });
                const err = new Error('JSON inválido en el cuerpo de la petición');
                err.status = 400;
                err.type = 'entity.parse.failed';
                throw err;
            }
        }
    }));
    
    app.use(express.urlencoded({ 
        extended: true, 
        limit: '10mb' 
    }));
    
    // 🔍 6. DEBUGGING: Middleware para verificar body parseado
    app.use((req, res, next) => {
        if (req.method === 'POST' || req.method === 'PUT') {
            logger.info(`📦 BODY PARSEADO:`, {
                method: req.method,
                url: req.url,
                hasBody: !!req.body,
                bodyType: typeof req.body,
                bodyKeys: req.body ? Object.keys(req.body) : [],
                bodyContent: req.body,
                requestId: req.requestId || req.headers['x-request-id']
            });
        }
        next();
    });
    
    // 7. Rate limiting global (después del parsing)
    app.use(globalRateLimit);
    
    // 8. Morgan logging
    if (process.env.NODE_ENV === 'development') {
        app.use(morgan('dev'));
    } else {
        app.use(morgan('combined', {
            skip: (req, res) => res.statusCode < 400
        }));
    }
    
    // 9. Headers de seguridad adicionales
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('X-API-Gateway', 'Ecommerce-Gateway/1.0');
        res.setHeader('X-Gateway-Version', process.env.API_VERSION || '1.0.0');
        next();
    });
    
    // 10. Health checks
    app.use('/health*', (req, res, next) => {
        req.isHealthCheck = true;
        next();
    });
};

const setupErrorHandling = (app) => {
    app.use('*', (req, res, next) => {
        const error = new Error(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
        error.status = 404;
        error.code = 'ROUTE_NOT_FOUND';
        next(error);
    });
    
    app.use(errorHandler);
};

module.exports = { 
    setupMiddleware, 
    setupErrorHandling 
};