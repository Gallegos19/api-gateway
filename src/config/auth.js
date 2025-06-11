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
        '/api/auth/forgot-password', 
        '/api/auth/reset-password',
        '/api/auth/refresh',
        '/api/products', // Productos son públicos para navegación
        '/api/products/:id' // Detalle de producto público
    ],
    
    // Rutas que requieren roles específicos
    roleBasedRoutes: {
        admin: [
            '/api/admin/*',
            '/api/users/admin/*',
            '/api/products/admin/*',
            '/api/orders/admin/*',
            '/api/emails/admin/*'
        ],
        moderator: [
            '/api/products/moderate/*',
            '/api/orders/moderate/*'
        ],
        user: [
            '/api/users/profile',
            '/api/cart/*',
            '/api/orders',
            '/api/orders/:id'
        ]
    },

    // Rutas que requieren autenticación pero no roles específicos
    protectedRoutes: [
        '/api/users/profile',
        '/api/cart',
        '/api/cart/*',
        '/api/orders',
        '/api/orders/*'
    ]
};

// Función para verificar si una ruta es pública
const isPublicRoute = (path) => {
    return authConfig.publicRoutes.some(route => {
        // Convertir rutas con parámetros a regex
        if (route.includes(':')) {
            const regexPattern = route.replace(/:[^\/]+/g, '[^/]+');
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(path);
        }
        
        // Rutas con wildcards
        if (route.includes('*')) {
            const baseRoute = route.replace('*', '');
            return path.startsWith(baseRoute);
        }
        
        // Rutas exactas
        return path === route || path.startsWith(route + '/');
    });
};

// Función para verificar si una ruta requiere autenticación
const requiresAuth = (path) => {
    if (isPublicRoute(path)) {
        return false;
    }
    
    return authConfig.protectedRoutes.some(route => {
        if (route.includes('*')) {
            const baseRoute = route.replace('*', '');
            return path.startsWith(baseRoute);
        }
        
        if (route.includes(':')) {
            const regexPattern = route.replace(/:[^\/]+/g, '[^/]+');
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(path);
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
        
        if (route.includes(':')) {
            const regexPattern = route.replace(/:[^\/]+/g, '[^/]+');
            const regex = new RegExp(`^${regexPattern}$`);
            return regex.test(path);
        }
        
        return path === route || path.startsWith(route + '/');
    });
};

// Función para verificar si una ruta requiere admin
const requiresAdmin = (path) => {
    return path.includes('/admin/') || 
           authConfig.roleBasedRoutes.admin.some(route => {
               if (route.includes('*')) {
                   const baseRoute = route.replace('*', '');
                   return path.startsWith(baseRoute);
               }
               return path === route;
           });
};

// Función para generar JWT
const generateToken = (user) => {
    const payload = {
        userId: user.id,
        email: user.email,
        profile: user.profile || 'user',
        iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(
        payload,
        authConfig.jwtSecret,
        { expiresIn: authConfig.jwtExpiresIn }
    );
};

// Función para verificar JWT
const verifyToken = (token) => {
    try {
        return jwt.verify(token, authConfig.jwtSecret);
    } catch (error) {
        throw new Error(`Token inválido: ${error.message}`);
    }
};

// Función para refrescar token
const refreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, authConfig.jwtSecret, { ignoreExpiration: true });
        
        // Crear nuevo token con los mismos datos
        return generateToken({
            id: decoded.userId,
            email: decoded.email,
            profile: decoded.profile
        });
    } catch (error) {
        throw new Error(`Error refrescando token: ${error.message}`);
    }
};

// Configuración de roles y permisos por servicio
const servicePermissions = {
    'user-service': {
        public: ['/health', '/api/users/register', '/api/users/login'],
        user: ['/api/users/profile'],
        admin: ['/api/users/admin/*']
    },
    'product-service': {
        public: ['/health', '/api/products', '/api/products/*'],
        user: [],
        admin: ['/api/products/admin/*']
    },
    'cart-service': {
        public: ['/health'],
        user: ['/api/cart', '/api/cart/*'],
        admin: ['/api/cart/admin/*']
    },
    'order-service': {
        public: ['/health'],
        user: ['/api/orders', '/api/orders/*'],
        admin: ['/api/orders/admin/*']
    },
    'email-service': {
        public: ['/health'],
        user: [],
        admin: ['/api/emails/*']
    }
};

module.exports = { 
    authConfig, 
    isPublicRoute, 
    requiresAuth,
    hasRolePermission, 
    requiresAdmin,
    generateToken,
    verifyToken,
    refreshToken,
    servicePermissions
};