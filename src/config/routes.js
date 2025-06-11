const userRoutes = require('../routes/userRoutes');
const productRoutes = require('../routes/productRoutes');
const cartRoutes = require('../routes/cartRoutes');
const orderRoutes = require('../routes/orderRoutes');
const paymentRoutes = require('../routes/paymentRoutes');
const emailRoutes = require('../routes/emailRoutes');
const { healthCheckRoutes } = require('../middleware/healthCheck');

const setupRoutes = (app, serviceRegistry) => {
    // Health checks del gateway y servicios
    healthCheckRoutes(app, serviceRegistry);
    
    // Configurar rutas de cada servicio
    userRoutes(app, serviceRegistry);
    productRoutes(app, serviceRegistry);
    cartRoutes(app, serviceRegistry);
    orderRoutes(app, serviceRegistry);
    paymentRoutes(app, serviceRegistry);
    emailRoutes(app, serviceRegistry);
    
    // Ruta para obtener información del gateway
    app.get('/api/gateway/info', (req, res) => {
        res.json({
            success: true,
            gateway: {
                name: 'E-commerce API Gateway',
                version: process.env.API_VERSION || '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                services: serviceRegistry.getAllServices().map(service => ({
                    name: service.name,
                    url: service.url,
                    status: service.status,
                    lastHealthCheck: service.lastHealthCheck
                }))
            }
        });
    });

    // Ruta para verificar token (útil para debugging)
    app.get('/api/auth/verify', (req, res) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Token requerido'
            });
        }

        try {
            const jwt = require('jsonwebtoken');
            const { authConfig } = require('./auth');
            const decoded = jwt.verify(token, authConfig.jwtSecret);
            
            res.json({
                success: true,
                valid: true,
                user: {
                    userId: decoded.userId,
                    email: decoded.email,
                    profile: decoded.profile,
                    iat: decoded.iat,
                    exp: decoded.exp,
                    expiresAt: new Date(decoded.exp * 1000).toISOString()
                }
            });
        } catch (error) {
            res.status(401).json({
                success: false,
                valid: false,
                error: error.message
            });
        }
    });

    // Endpoint para obtener configuración de rutas públicas
    app.get('/api/gateway/routes', (req, res) => {
        const { authConfig } = require('./auth');
        
        res.json({
            success: true,
            routes: {
                public: authConfig.publicRoutes,
                protected: authConfig.protectedRoutes,
                roleBasedRoutes: authConfig.roleBasedRoutes
            }
        });
    });
    
    // 404 para rutas no encontradas
    app.use('*', (req, res) => {
        res.status(404).json({
            success: false,
            error: 'Ruta no encontrada',
            path: req.originalUrl,
            method: req.method,
            timestamp: new Date().toISOString(),
            availableEndpoints: {
                auth: [
                    'POST /api/auth/register',
                    'POST /api/auth/login',
                    'POST /api/auth/forgot-password',
                    'POST /api/auth/reset-password',
                    'GET /api/auth/verify'
                ],
                users: [
                    'GET /api/users/profile',
                    'PUT /api/users/profile'
                ],
                products: [
                    'GET /api/products',
                    'GET /api/products/:id',
                    'POST /api/products (admin)',
                    'PUT /api/products/:id (admin)',
                    'DELETE /api/products/:id (admin)'
                ],
                cart: [
                    'GET /api/cart',
                    'POST /api/cart/items',
                    'PUT /api/cart/items/:itemId',
                    'DELETE /api/cart/items/:itemId',
                    'DELETE /api/cart'
                ],
                orders: [
                    'GET /api/orders',
                    'POST /api/orders',
                    'GET /api/orders/:id',
                    'PUT /api/orders/:id/cancel',
                    'GET /api/admin/orders (admin)',
                    'PUT /api/admin/orders/:id/status (admin)'
                ],
                payments: [
                    'POST /api/payments/process',
                    'GET /api/payments/:id',
                    'GET /api/payments'
                ],
                emails: [
                    'POST /api/emails/send (admin)',
                    'GET /api/emails/templates (admin)'
                ],
                health: [
                    'GET /health',
                    'GET /health/services',
                    'GET /health/services/:serviceName'
                ]
            }
        });
    });
};

module.exports = setupRoutes;