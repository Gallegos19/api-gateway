const rateLimit = require('express-rate-limit');
const { rateLimitConfig } = require('../config/rateLimiting');
const logger = require('../utils/logger');

// Rate limiting global
const globalRateLimit = rateLimit({
    ...rateLimitConfig.global,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Rate limit excedido para IP: ${req.ip} - ${req.method} ${req.path}`);
        res.status(429).json(rateLimitConfig.global.message);
    }
});

// Función para crear rate limiting específico por servicio
const createServiceRateLimit = (serviceName) => {
    const config = rateLimitConfig.services[serviceName] || rateLimitConfig.global;
    
    return rateLimit({
        ...config,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Usar una combinación de IP y usuario (si está autenticado)
            const baseKey = req.ip;
            const userKey = req.user ? req.user.id : '';
            return `${serviceName}:${baseKey}:${userKey}`;
        },
        handler: (req, res) => {
            logger.warn(`Rate limit de ${serviceName} excedido para IP: ${req.ip}, Usuario: ${req.user?.email || 'anónimo'}`);
            res.status(429).json({
                ...config.message,
                service: serviceName
            });
        }
    });
};

module.exports = {
    globalRateLimit,
    createServiceRateLimit
};