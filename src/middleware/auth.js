const jwt = require('jsonwebtoken');
const { authConfig, isPublicRoute, hasRolePermission } = require('../config/auth');
const { UnauthorizedError, ForbiddenError } = require('../shared/errors/CustomErrors');
const logger = require('../utils/logger');

// Middleware principal de autenticación
const authenticateToken = (req, res, next) => {
    // Verificar si la ruta es pública
    if (isPublicRoute(req.path)) {
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        throw new UnauthorizedError('Token de acceso requerido');
    }

    try {
        const decoded = jwt.verify(token, authConfig.jwtSecret);
        req.user = decoded;
        
        // Log de acceso autenticado
        logger.info(`Usuario autenticado: ${decoded.email} - ${req.method} ${req.path}`);
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new UnauthorizedError('Token expirado');
        } else if (error.name === 'JsonWebTokenError') {
            throw new UnauthorizedError('Token inválido');
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

        if (!roles.includes(req.user.role)) {
            logger.warn(`Acceso denegado para ${req.user.email} - Rol requerido: ${roles.join(', ')} - Rol actual: ${req.user.role}`);
            throw new ForbiddenError('No tienes permisos para acceder a este recurso', {
                requiredRoles: roles,
                userRole: req.user.role
            });
        }

        next();
    };
};
// Middleware para verificar permisos específicos de ruta
const checkRoutePermissions = (req, res, next) => {
    if (!req.user) {
        return next();
    }

    const userRole = req.user.role;
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

module.exports = {
    authenticateToken,
    authorizeRoles,
    checkRoutePermissions
};