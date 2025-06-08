const jwt = require('jsonwebtoken');
const { config } = require('./services');

const authConfig = {
    jwtSecret: config.gateway.jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    
    // Rutas públicas que no requieren autenticación
    publicRoutes: [
        '/health',
        '/health/services',
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/products' // Productos son públicos para navegación
    ],
    
    // Rutas que requieren roles específicos
    roleBasedRoutes: {
        admin: [
            '/api/admin/*',
            '/api/users/admin/*',
            '/api/products/admin/*'
        ],
        moderator: [
            '/api/products/moderate/*',
            '/api/orders/moderate/*'
        ]
    }
};

// Función para verificar si una ruta es pública
const isPublicRoute = (path) => {
    return authConfig.publicRoutes.some(route => {
        if (route.includes('*')) {
            const baseRoute = route.replace('*', '');
            return path.startsWith(baseRoute);
        }
        return path === route || path.startsWith(route + '/');
    });
};

// Función para verificar permisos de rol
const hasRolePermission = (userRole, path) => {
    const roleRoutes = authConfig.roleBasedRoutes[userRole] || [];
    return roleRoutes.some(route => {
        if (route.includes('*')) {
            const baseRoute = route.replace('*', '');
            return path.startsWith(baseRoute);
        }
        return path === route || path.startsWith(route + '/');
    });
};

module.exports = { authConfig, isPublicRoute, hasRolePermission };
