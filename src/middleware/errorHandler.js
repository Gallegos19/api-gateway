const logger = require('../utils/logger');
const { 
    CustomError, 
    ValidationError, 
    UnauthorizedError, 
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError 
} = require('../shared/errors/CustomErrors');

const errorHandler = (error, req, res, next) => {
    // Si ya se envió una respuesta, delegar al handler por defecto de Express
    if (res.headersSent) {
        return next(error);
    }

    let statusCode = 500;
    let errorResponse = {
        error: 'Error interno del servidor',
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method
    };

    // Manejo de errores personalizados
    if (error instanceof CustomError) {
        statusCode = error.statusCode;
        errorResponse = {
            ...errorResponse,
            error: error.message,
            code: error.code,
            ...(error.data && { data: error.data })
        };
    }
    // Errores de validación de Joi
    else if (error.name === 'ValidationError' && error.details) {
        statusCode = 400;
        errorResponse = {
            ...errorResponse,
            error: 'Datos de entrada inválidos',
            code: 'VALIDATION_ERROR',
            details: error.details
        };
    }
    // Errores de JWT
    else if (error.name === 'JsonWebTokenError') {
        statusCode = 401;
        errorResponse = {
            ...errorResponse,
            error: 'Token inválido',
            code: 'INVALID_TOKEN'
        };
    }
    else if (error.name === 'TokenExpiredError') {
        statusCode = 401;
        errorResponse = {
            ...errorResponse,
            error: 'Token expirado',
            code: 'TOKEN_EXPIRED'
        };
    }
    // Errores de conexión a servicios
    else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        statusCode = 503;
        errorResponse = {
            ...errorResponse,
            error: 'Servicio temporalmente no disponible',
            code: 'SERVICE_UNAVAILABLE'
        };
    }
    // Errores de sintaxis JSON
    else if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        statusCode = 400;
        errorResponse = {
            ...errorResponse,
            error: 'JSON inválido en el cuerpo de la petición',
            code: 'INVALID_JSON'
        };
    }

    // Log del error
    if (statusCode >= 500) {
        logger.error('Error interno del servidor', {
            error: error.message,
            stack: error.stack,
            requestId: req.requestId,
            userId: req.user?.id,
            path: req.originalUrl,
            method: req.method
        });
    } else {
        logger.warn('Error de cliente', {
            error: error.message,
            statusCode,
            requestId: req.requestId,
            userId: req.user?.id,
            path: req.originalUrl,
            method: req.method
        });
    }

    res.status(statusCode).json(errorResponse);
};

// Middleware para capturar errores async
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = { errorHandler, asyncHandler };
