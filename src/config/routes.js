const userRoutes = require('../routes/userRoutes');
const productRoutes = require('../routes/productRoutes');
const cartRoutes = require('../routes/cartRoutes');
const orderRoutes = require('../routes/orderRoutes');
const paymentRoutes = require('../routes/paymentRoutes');
const emailRoutes = require('../routes/emailRoutes');

const setupRoutes = (app, serviceRegistry) => {
    // Health check simple
    app.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    });

    // Configurar rutas de servicios
    userRoutes(app, serviceRegistry);
    productRoutes(app, serviceRegistry);
    cartRoutes(app, serviceRegistry);
    orderRoutes(app, serviceRegistry);
    paymentRoutes(app, serviceRegistry);
    emailRoutes(app, serviceRegistry);
    
    // 404 para rutas no encontradas
    app.use('*', (req, res) => {
        res.status(404).json({
            error: 'Ruta no encontrada',
            path: req.originalUrl
        });
    });
};

module.exports = setupRoutes;