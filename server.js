const express = require('express');
const { config } = require('./src/config/services');
const routes = require('./src/config/routes');
const { setupMiddleware } = require('./src/middleware');
const logger = require('./src/utils/logger');
const ServiceRegistry = require('./src/services/ServiceRegistry');
const HealthChecker = require('./src/services/HealthChecker');

class APIGateway {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.serviceRegistry = new ServiceRegistry();
        this.healthChecker = new HealthChecker(this.serviceRegistry);
        
        this.initialize();
    }

    async initialize() {
        try {
            // Configurar middlewares
            setupMiddleware(this.app);
            
            // Configurar rutas
            routes(this.app, this.serviceRegistry);
            
            // Registrar servicios
            await this.serviceRegistry.registerServices(config.services);
            
            // Iniciar health checker
            this.healthChecker.startHealthChecks();
            
            logger.info('API Gateway inicializado correctamente');
        } catch (error) {
            logger.error('Error inicializando API Gateway:', error);
            process.exit(1);
        }
    }

    start() {
        this.app.listen(this.port, () => {
            logger.info(`🚀 API Gateway ejecutándose en puerto ${this.port}`);
            logger.info(`📊 Health check disponible en http://localhost:${this.port}/health`);
        });
    }
}

// Iniciar el servidor
if (require.main === module) {
    const gateway = new APIGateway();
    gateway.start();

    // Manejo de señales de cierre
    process.on('SIGTERM', () => {
        logger.info('Cerrando API Gateway...');
        process.exit(0);
    });
}

module.exports = APIGateway