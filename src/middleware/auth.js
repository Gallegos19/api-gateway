const jwt = require('jsonwebtoken');
const { authConfig, isPublicRoute, hasRolePermission } = require('../config/auth');
const { UnauthorizedError, ForbiddenError } = require('../shared/errors/CustomErrors');
const logger = require('../utils/logger');

// Middleware principal de autenticación y validación JWT
const authenticateToken = (req, res, next) => {
    // Verificar si la ruta es pública
    if (isPublicRoute(req.path)) {
        logger.debug(`Ruta pública detectada: ${req.path}`);
        return next();
    }

    // Extraer token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        logger.warn('Token de acceso faltante', {
            path: req.path,
            method: req.method,
            ip: req.ip
        });
        throw new UnauthorizedError('Token de acceso requerido');
    }

    try {
        // Verificar y decodificar el JWT
        const decoded = jwt.verify(token, authConfig.jwtSecret);
        
        // Validar estructura del token
        if (!decoded.userId || !decoded.email) {
            throw new UnauthorizedError('Token inválido - datos incompletos');
        }

        // Crear objeto de usuario basado en el token
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            profile: decoded.profile || 'user',
            role: decoded.profile || 'user', // Alias para compatibilidad
            iat: decoded.iat,
            exp: decoded.exp
        };

        // Log de acceso autenticado
        logger.info(`Usuario autenticado: ${decoded.email} - ${req.method} ${req.path}`, {
            userId: decoded.userId,
            profile: decoded.profile,
            tokenExp: new Date(decoded.exp * 1000).toISOString()
        });
        
        next();
    } catch (error) {
        logger.warn('Error de autenticación JWT', {
            error: error.message,
            path: req.path,
            method: req.method,
            ip: req.ip,
            tokenProvided: !!token
        });

        if (error.name === 'TokenExpiredError') {
            throw new UnauthorizedError('Token expirado');
        } else if (error.name === 'JsonWebTokenError') {
            throw new UnauthorizedError('Token inválido');
        } else if (error instanceof UnauthorizedError) {
            throw error;
        } else {
            throw new UnauthorizedError('Error de autenticación');
        }
    }
};

// Middleware de autorización por roles
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new UnauthorizedError('Usuario no autenticado');
        }

        const userRole = req.user.profile || req.user.role;
        
        if (!roles.includes(userRole)) {
            logger.warn(`Acceso denegado por rol`, {
                userId: req.user.userId,
                email: req.user.email,
                userRole,
                requiredRoles: roles,
                path: req.path,
                method: req.method
            });
            
            throw new ForbiddenError('No tienes permisos para acceder a este recurso', {
                requiredRoles: roles,
                userRole
            });
        }

        logger.debug(`Autorización por rol exitosa`, {
            userId: req.user.userId,
            userRole,
            path: req.path
        });

        next();
    };
};

// Middleware para verificar permisos específicos de ruta
const checkRoutePermissions = (req, res, next) => {
    if (!req.user) {
        return next();
    }

    const userRole = req.user.profile || req.user.role;
    const path = req.path;

    // Verificar si el usuario tiene permisos para esta ruta específica
    if (userRole !== 'admin' && !hasRolePermission(userRole, path)) {
        // Verificar rutas que requieren admin
        if (path.includes('/admin/')) {
            throw new ForbiddenError('Se requieren permisos de administrador');
        }
    }

    next();
};

// Middleware para agregar headers de usuario a las peticiones hacia microservicios
const addUserHeaders = (req, res, next) => {
    if (req.user) {
        // Headers que necesitan los microservicios
        req.headers['x-user-id'] = req.user.userId;
        req.headers['x-user-email'] = req.user.email;
        req.headers['x-user-role'] = req.user.profile || req.user.role || 'user';
        req.headers['x-user-profile'] = req.user.profile || 'user';
        
        // Headers de trazabilidad
        req.headers['x-request-id'] = req.requestId || generateRequestId();
        req.headers['x-calling-service'] = 'api-gateway';
        req.headers['x-gateway-timestamp'] = Date.now().toString();
        
        logger.debug('Headers de usuario agregados', {
            userId: req.user.userId,
            email: req.user.email,
            role: req.user.profile,
            requestId: req.headers['x-request-id']
        });
    }
    
    next();
};

// Middleware especial para rutas de autenticación (registro/login)
const handleAuthRoutes = (req, res, next) => {
    // Para rutas como /api/auth/register y /api/auth/login
    // Solo agregar headers de trazabilidad, no de usuario
    if (!req.headers['x-request-id']) {
        req.headers['x-request-id'] = generateRequestId();
    }
    req.headers['x-calling-service'] = 'api-gateway';
    req.headers['x-gateway-timestamp'] = Date.now().toString();
    
    next();
};

// Función auxiliar para generar ID de request
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Middleware para validar token opcional (para métricas, logs, etc.)
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        try {
            const decoded = jwt.verify(token, authConfig.jwtSecret);
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                profile: decoded.profile || 'user',
                role: decoded.profile || 'user'
            };
        } catch (error) {
            // Token inválido pero no fallar, solo ignorar
            logger.debug('Token opcional inválido, continuando sin autenticación', {
                error: error.message
            });
        }
    }

    next();
};

// Middleware para rutas de administración
const requireAdmin = (req, res, next) => {
    const userRole = req.user?.profile || req.user?.role;
    
    if (userRole !== 'admin') {
        logger.warn('Intento de acceso admin denegado', {
            userId: req.user?.userId,
            userRole,
            path: req.path,
            method: req.method
        });
        
        throw new ForbiddenError('Se requieren permisos de administrador');
    }
    
    next();
};

// Middleware combinado para rutas protegidas
const protectedRoute = [
    authenticateToken,
    addUserHeaders,
    checkRoutePermissions
];

// Middleware combinado para rutas de admin
const adminRoute = [
    authenticateToken,
    requireAdmin,
    addUserHeaders
];

// Middleware combinado para rutas públicas con headers
const publicRoute = [
    optionalAuth,
    addUserHeaders
];

module.exports = {
    authenticateToken,
    authorizeRoles,
    checkRoutePermissions,
    addUserHeaders,
    handleAuthRoutes,
    optionalAuth,
    requireAdmin,
    protectedRoute,
    adminRoute,
    publicRoute,
    generateRequestId
};