const logger = require('../utils/logger');

class HealthChecker {
    constructor(serviceRegistry) {
        this.serviceRegistry = serviceRegistry;
        this.checkInterval = process.env.HEALTH_CHECK_INTERVAL || 30000; // 30 segundos
        this.intervalId = null;
        this.isRunning = false;
    }

    // Iniciar health checks periódicos
    startHealthChecks() {
        if (this.isRunning) {
            logger.warn('Health checker ya está ejecutándose');
            return;
        }

        this.isRunning = true;
        logger.info(`Iniciando health checks cada ${this.checkInterval}ms`);

        // Ejecutar health check inmediatamente
        this.performHealthChecks();

        // Configurar intervalo para health checks periódicos
        this.intervalId = setInterval(() => {
            this.performHealthChecks();
        }, this.checkInterval);
    }

    // Detener health checks
    stopHealthChecks() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        logger.info('Health checks detenidos');
    }

    // Realizar health checks de todos los servicios
    async performHealthChecks() {
        try {
            const services = this.serviceRegistry.getAllServices();
            const healthCheckPromises = services.map(service => 
                this.checkServiceHealth(service)
            );

            const results = await Promise.allSettled(healthCheckPromises);
            
            let healthyCount = 0;
            let unhealthyCount = 0;

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value?.isHealthy) {
                    healthyCount++;
                } else {
                    unhealthyCount++;
                    const serviceName = services[index].name;
                    logger.warn(`Servicio no saludable detectado: ${serviceName}`);
                }
            });

            logger.debug(`Health check completado - Saludables: ${healthyCount}, No saludables: ${unhealthyCount}`);

        } catch (error) {
            logger.error('Error durante health checks:', error);
        }
    }

    // Verificar salud de un servicio específico
    async checkServiceHealth(service) {
        const startTime = Date.now();
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

            const response = await fetch(`${service.url}${service.healthPath}`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'API-Gateway-HealthChecker/1.0',
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;
            const isHealthy = response.ok;

            // Actualizar estado en el registro
            const healthData = {
                isHealthy,
                responseTime,
                statusCode: response.status,
                timestamp: new Date().toISOString()
            };

            if (isHealthy) {
                this.onServiceHealthy(service, healthData);
            } else {
                this.onServiceUnhealthy(service, new Error(`HTTP ${response.status}`), healthData);
            }

            return healthData;

        } catch (error) {
            const responseTime = Date.now() - startTime;
            const healthData = {
                isHealthy: false,
                responseTime,
                error: error.message,
                timestamp: new Date().toISOString()
            };

            this.onServiceUnhealthy(service, error, healthData);
            return healthData;
        }
    }

    // Manejar servicio saludable
    onServiceHealthy(service, healthData) {
        const previousStatus = service.status;
        service.status = 'healthy';
        service.lastHealthCheck = healthData.timestamp;
        service.failureCount = 0;
        service.lastResponseTime = healthData.responseTime;

        if (previousStatus === 'unhealthy') {
            logger.info(`Servicio recuperado: ${service.name} - Tiempo de respuesta: ${healthData.responseTime}ms`);
        }
    }

    // Manejar servicio no saludable
    onServiceUnhealthy(service, error, healthData) {
        service.status = 'unhealthy';
        service.lastHealthCheck = healthData.timestamp;
        service.failureCount = (service.failureCount || 0) + 1;
        service.lastError = error.message;

        logger.warn(`Servicio no saludable: ${service.name} - Error: ${error.message} - Fallos consecutivos: ${service.failureCount}`);

        // Notificar al circuit breaker
        const circuitBreaker = this.serviceRegistry.getCircuitBreaker(service.name);
        if (circuitBreaker) {
            circuitBreaker.recordFailure();
        }
    }

    // Obtener resumen de salud
    getHealthSummary() {
        const services = this.serviceRegistry.getAllServices();
        
        return {
            totalServices: services.length,
            healthyServices: services.filter(s => s.status === 'healthy').length,
            unhealthyServices: services.filter(s => s.status === 'unhealthy').length,
            unknownServices: services.filter(s => s.status === 'unknown').length,
            lastCheck: new Date().toISOString()
        };
    }
}

module.exports = HealthChecker;
