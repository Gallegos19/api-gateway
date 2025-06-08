const services = {
    user: {
        name: 'user-service',
        url: process.env.USER_SERVICE_URL || 'http://localhost:3001',
        healthPath: '/health',
        timeout: 30000,
        retries: 3,
        weight: 1
    },
    product: {
        name: 'product-service',
        url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
        healthPath: '/health',
        timeout: 30000,
        retries: 3,
        weight: 1
    },
    cart: {
        name: 'cart-service',
        url: process.env.CART_SERVICE_URL || 'http://localhost:3003',
        healthPath: '/health',
        timeout: 30000,
        retries: 3,
        weight: 1
    },
    order: {
        name: 'order-service',
        url: process.env.ORDER_SERVICE_URL || 'http://localhost:3004',
        healthPath: '/health',
        timeout: 30000,
        retries: 3,
        weight: 1
    },
    payment: {
        name: 'payment-service',
        url: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005',
        healthPath: '/health',
        timeout: 60000, // Mayor timeout para pagos
        retries: 1, // Menos reintentos para evitar doble cobro
        weight: 1
    },
    email: {
        name: 'email-service',
        url: process.env.EMAIL_SERVICE_URL || 'http://localhost:3006',
        healthPath: '/health',
        timeout: 45000,
        retries: 2,
        weight: 1
    }
};

const config = {
    services,
    gateway: {
        port: process.env.PORT || 3000,
        environment: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
        corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        jwtSecret: process.env.JWT_SECRET || 'tu_jwt_secret_super_seguro',
        rateLimiting: {
            windowMs: 15 * 60 * 1000, // 15 minutos
            max: 1000 // requests por IP
        }
    }
};

module.exports = { config, services };