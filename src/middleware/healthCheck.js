const logger = require('../utils/logger');

const healthCheckRoutes = (app, serviceRegistry) => {
    // Health check del gateway
    app.get('/health', (req, res) => {
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: {
                seconds: uptime,
                human: formatUptime(uptime)
            },
            memory: {
                used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
            },
            version: process.env.API_VERSION || '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        });
    });

    // Health check de todos los servicios
    app.get('/health/services', async (req, res) => {
        try {
            const servicesHealth = await serviceRegistry.checkAllServicesHealth();
            const overallStatus = servicesHealth.every(service => service.status === 'healthy') 
                ? 'healthy' : 'unhealthy';

            res.json({
                status: overallStatus,
                gateway: 'healthy',
                services: servicesHealth,
                timestamp: new Date().toISOString(),
                summary: {
                    total: servicesHealth.length,
                    healthy: servicesHealth.filter(s => s.status === 'healthy').length,
                    unhealthy: servicesHealth.filter(s => s.status === 'unhealthy').length
                }
            });
        } catch (error) {
            logger.error('Error en health check de servicios:', error);
            res.status(503).json({
                status: 'error',
                error: 'No se pudo verificar el estado de los servicios',
                timestamp: new Date().toISOString()
            });
        }
    });

    // Health check de un servicio específico
    app.get('/health/services/:serviceName', async (req, res) => {
        try {
            const { serviceName } = req.params;
            const serviceHealth = await serviceRegistry.checkServiceHealth(serviceName);
            
            if (!serviceHealth) {
                return res.status(404).json({
                    error: 'Servicio no encontrado',
                    service: serviceName
                });
            }

            res.json(serviceHealth);
        } catch (error) {
            logger.error(`Error en health check del servicio ${req.params.serviceName}:`, error);
            res.status(503).json({
                status: 'error',
                service: req.params.serviceName,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });
};

const formatUptime = (uptime) => {
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
};

module.exports = { healthCheckRoutes };