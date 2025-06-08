class CustomError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', data = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.data = data;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends CustomError {
    constructor(message, data = null) {
        super(message, 400, 'VALIDATION_ERROR', data);
    }
}

class UnauthorizedError extends CustomError {
    constructor(message = 'No autorizado', data = null) {
        super(message, 401, 'UNAUTHORIZED', data);
    }
}

class ForbiddenError extends CustomError {
    constructor(message = 'Acceso denegado', data = null) {
        super(message, 403, 'FORBIDDEN', data);
    }
}

class NotFoundError extends CustomError {
    constructor(message = 'Recurso no encontrado', data = null) {
        super(message, 404, 'NOT_FOUND', data);
    }
}

class ConflictError extends CustomError {
    constructor(message = 'Conflicto', data = null) {
        super(message, 409, 'CONFLICT', data);
    }
}

class ServiceUnavailableError extends CustomError {
    constructor(message = 'Servicio no disponible', data = null) {
        super(message, 503, 'SERVICE_UNAVAILABLE', data);
    }
}

class RateLimitError extends CustomError {
    constructor(message = 'Límite de velocidad excedido', data = null) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED', data);
    }
}

module.exports = {
    CustomError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    ServiceUnavailableError,
    RateLimitError
};