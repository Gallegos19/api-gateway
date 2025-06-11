const jwt = require('jsonwebtoken');
const { authConfig, isPublicRoute, hasRolePermission } = require('../config/auth');
const { UnauthorizedError, ForbiddenError } = require('../shared/errors/CustomErrors');
const logger = require('../utils/logger');

// Middleware principal de autenticación y validación JWT
const authenticateToken = (req, res, next) => {
    logger.info(`🔐 AUTHENTICATE TOKEN - Iniciando:`, {
        method: req.method,
        path: req.path,
        url: req.url,
        hasAuthHeader: !!req.headers['authorization'],
        authHeader: req.headers['authorization'] ? 'Bearer ***' : 'No auth header',
        xUserRole: req.headers['x-user-role'],
        xUserId: req.headers['x-user-id'],
        xUserEmail: req.headers['x-user-email'],
        requestId: req.requestId
    });

    // Verificar si la ruta es pública
    if (isPublicRoute(req.path)) {
        logger.info(`🔓 AUTHENTICATE TOKEN - Ruta pública detectada: ${req.path}`);
        return next();
    }

    // Extraer token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        logger.warn('🚫 AUTHENTICATE TOKEN - Token faltante:', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            authHeader: req.headers['authorization'] || 'No Authorization header',
            allHeaders: Object.keys(req.headers),
            requestId: req.requestId
        });
        throw new UnauthorizedError('Token de acceso requerido');
    }

    try {
        // Verificar y decodificar el JWT
        logger.info(`🔍 AUTHENTICATE TOKEN - Verificando JWT:`, {
            tokenLength: token.length,
            tokenPreview: token.substring(0, 20) + '...',
            jwtSecretConfigured: !!authConfig.jwtSecret,
            requestId: req.requestId
        });

        const decoded = jwt.verify(token, authConfig.jwtSecret);
        
        logger.info(`✅ AUTHENTICATE TOKEN - JWT válido:`, {
            userId: decoded.userId,
            email: decoded.email,
            profile: decoded.profile,
            iat: decoded.iat,
            exp: decoded.exp,
            expiresAt: new Date(decoded.exp * 1000).toISOString(),
            requestId: req.requestId
        });

        // Validar estructura del token
        if (!decoded.userId || !decoded.email) {
            logger.error(`❌ AUTHENTICATE TOKEN - Token inválido - datos incompletos:`, {
                hasUserId: !!decoded.userId,
                hasEmail: !!decoded.email,
                decoded,
                requestId: req.requestId
            });
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

        logger.info(`👤 AUTHENTICATE TOKEN - Usuario establecido:`, {
            userId: req.user.userId,
            email: req.user.email,
            profile: req.user.profile,
            role: req.user.role,
            requestId: req.requestId
        });
        
        next();
    } catch (error) {
        logger.error('❌ AUTHENTICATE TOKEN - Error JWT:', {
            error: error.message,
            name: error.name,
            path: req.path,
            method: req.method,
            ip: req.ip,
            tokenProvided: !!token,
            tokenLength: token ? token.length : 0,
            requestId: req.requestId
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
        logger.info(`🔒 AUTHORIZE ROLES - Verificando roles:`, {
            requiredRoles: roles,
            hasUser: !!req.user,
            userRole: req.user?.profile || req.user?.role,
            userId: req.user?.userId,
            requestId: req.requestId
        });

        if (!req.user) {
            logger.error(`❌ AUTHORIZE ROLES - Usuario no autenticado`);
            throw new UnauthorizedError('Usuario no autenticado');
        }

        const userRole = req.user.profile || req.user.role;
        
        if (!roles.includes(userRole)) {
            logger.warn(`🚫 AUTHORIZE ROLES - Acceso denegado:`, {
                userId: req.user.userId,
                email: req.user.email,
                userRole,
                requiredRoles: roles,
                path: req.path,
                method: req.method,
                requestId: req.requestId
            });
            
            throw new ForbiddenError('No tienes permisos para acceder a este recurso', {
                requiredRoles: roles,
                userRole
            });
        }

        logger.info(`✅ AUTHORIZE ROLES - Autorización exitosa:`, {
            userId: req.user.userId,
            userRole,
            requiredRoles: roles,
            requestId: req.requestId
        });

        next();
    };
};

// Middleware para verificar permisos específicos de ruta
const checkRoutePermissions = (req, res, next) => {
    logger.info(`🛡️ CHECK ROUTE PERMISSIONS:`, {
        hasUser: !!req.user,
        userRole: req.user?.profile || req.user?.role,
        path: req.path,
        requestId: req.requestId
    });

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
    logger.info(`📤 ADD USER HEADERS:`, {
        hasUser: !!req.user,
        beforeHeaders: {
            'x-user-id': req.headers['x-user-id'],
            'x-user-role': req.headers['x-user-role'],
            'x-user-email': req.headers['x-user-email']
        },
        requestId: req.requestId
    });

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
        
        logger.info(`✅ ADD USER HEADERS - Headers agregados:`, {
            'x-user-id': req.headers['x-user-id'],
            'x-user-email': req.headers['x-user-email'],
            'x-user-role': req.headers['x-user-role'],
            'x-request-id': req.headers['x-request-id'],
            requestId: req.requestId
        });
    } else {
        logger.warn(`⚠️ ADD USER HEADERS - No hay usuario para agregar headers`);
    }
    
    next();
};

// Middleware especial para rutas de autenticación (registro/login)
const handleAuthRoutes = (req, res, next) => {
    logger.info(`🔐 HANDLE AUTH ROUTES:`, {
        method: req.method,
        path: req.path,
        requestId: req.requestId
    });

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
    logger.info(`🔓 OPTIONAL AUTH:`, {
        method: req.method,
        path: req.path,
        hasAuthHeader: !!req.headers['authorization'],
        requestId: req.requestId
    });

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
            logger.info(`✅ OPTIONAL AUTH - Usuario opcional establecido:`, {
                userId: req.user.userId,
                role: req.user.role,
                requestId: req.requestId
            });
        } catch (error) {
            // Token inválido pero no fallar, solo ignorar
            logger.info(`⚠️ OPTIONAL AUTH - Token opcional inválido, continuando sin autenticación:`, {
                error: error.message,
                requestId: req.requestId
            });
        }
    } else {
        logger.info(`🔓 OPTIONAL AUTH - No hay token, continuando sin autenticación`);
    }

    next();
};

// Middleware para rutas de administración
const requireAdmin = (req, res, next) => {
    logger.info(`👑 REQUIRE ADMIN:`, {
        hasUser: !!req.user,
        userRole: req.user?.profile || req.user?.role,
        requestId: req.requestId
    });

    const userRole = req.user?.profile || req.user?.role;
    
    if (userRole !== 'admin') {
        logger.warn(`🚫 REQUIRE ADMIN - Acceso denegado:`, {
            userId: req.user?.userId,
            userRole,
            path: req.path,
            method: req.method,
            requestId: req.requestId
        });
        
        throw new ForbiddenError('Se requieren permisos de administrador');
    }
    
    logger.info(`✅ REQUIRE ADMIN - Admin verificado exitosamente`);
    next();
};

// Middleware combinado para rutas protegidas
const protectedRoute = [
    //authenticateToken,
    addUserHeaders,
    checkRoutePermissions
];

// Middleware combinado para rutas de admin
const adminRoute = [
    //authenticateToken,
    //requireAdmin,
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