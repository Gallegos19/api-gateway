const rateLimitConfig = {
    // Rate limiting global
    global: {
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 1000, // requests por IP
        message: {
            error: 'Demasiadas peticiones desde esta IP',
            retryAfter: '15 minutos'
        }
    },
    
    // Rate limiting por servicio
    services: {
        auth: {
            windowMs: 15 * 60 * 1000,
            max: 50, // Más restrictivo para autenticación
            message: {
                error: 'Demasiados intentos de autenticación',
                retryAfter: '15 minutos'
            }
        },
        products: {
            windowMs: 15 * 60 * 1000,
            max: 500, // Más permisivo para consultas de productos
            message: {
                error: 'Límite de consultas de productos excedido',
                retryAfter: '15 minutos'
            }
        },
        cart: {
            windowMs: 15 * 60 * 1000,
            max: 300,
            message: {
                error: 'Límite de operaciones de carrito excedido',
                retryAfter: '15 minutos'
            }
        },
        orders: {
            windowMs: 15 * 60 * 1000,
            max: 100,
            message: {
                error: 'Límite de operaciones de pedidos excedido',
                retryAfter: '15 minutos'
            }
        },
        payments: {
            windowMs: 15 * 60 * 1000,
            max: 50, // Muy restrictivo para pagos
            message: {
                error: 'Límite de operaciones de pago excedido',
                retryAfter: '15 minutos'
            }
        },
        emails: {
            windowMs: 15 * 60 * 1000,
            max: 30, // Muy restrictivo para emails
            message: {
                error: 'Límite de envío de emails excedido',
                retryAfter: '15 minutos'
            }
        }
    }
};

module.exports = { rateLimitConfig };