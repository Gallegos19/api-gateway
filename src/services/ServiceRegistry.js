const logger = require('../utils/logger');
const LoadBalancer = require('./LoadBalancer');
const CircuitBreaker = require('./CircuitBreaker');

class ServiceRegistry {
    constructor() {
        this.services = new Map();
        this.loadBalancer = new LoadBalancer();
        this.circuitBreakers = new Map();
    }

    // Registrar un servicio
    registerService(name, config) {
        const service = {
            name,
            ...config,
            instances: [config.url], // Por ahora una sola instancia, expandible
            lastHealthCheck: null,
            status: 'unknown',
            failureCount: 0,
            registeredAt: new Date().toISOString()
        };

        this.services.set(name, service);
        
        // Crear circuit breaker para este servicio
        this.circuitBreakers.set(name, new CircuitBreaker({
            failureThreshold: 5,
            recoveryTimeout: 30000,
            monitoringPeriod: 10000
        }));

        logger.info(`Servicio registrado: ${name} - ${config.url}`);
        return service;
    }

    // Registrar múltiples servicios
    async registerServices(servicesConfig) {
        const registrationPromises = Object.entries(servicesConfig).map(
            ([name, config]) => this.registerService(name, config)
        );

        await Promise.all(registrationPromises);
        logger.info(`${registrationPromises.length} servicios registrados exitosamente`);
    }

    // Obtener un servicio por nombre
    getService(name) {
        return this.services.get(name);
    }

    // Obtener todos los servicios
    getAllServices() {
        return Array.from(this.services.values());
    }

    // Obtener una instancia disponible de un servicio (con load balancing)
    getServiceInstance(serviceName) {
        const service = this.services.get(serviceName);
        if (service.status === 'unhealthy') {
            throw new Error(`Servicio ${serviceName} no disponible`);
        }

        // Usar load balancer para obtener la mejor instancia
        return this.loadBalancer.getNextInstance(service);
    }

    // Verificar salud de un servicio específico
    async checkServiceHealth(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            return null;
        }

        const startTime = Date.now();
        try {
            const response = await fetch(`${service.url}${service.healthPath}`, {
                method: 'GET',
                timeout: 5000,
                headers: {
                    'User-Agent': 'API-Gateway-HealthChecker/1.0'
                }
            });

            const responseTime = Date.now() - startTime;
            const isHealthy = response.ok;

            // Actualizar estado del servicio
            service.status = isHealthy ? 'healthy' : 'unhealthy';
            service.lastHealthCheck = new Date().toISOString();
            service.failureCount = isHealthy ? 0 : service.failureCount + 1;

            return {
                name: serviceName,
                status: service.status,
                url: service.url,
                responseTime: `${responseTime}ms`,
                lastCheck: service.lastHealthCheck,
                failureCount: service.failureCount
            };
        } catch (error) {
            service.status = 'unhealthy';
            service.lastHealthCheck = new Date().toISOString();
            service.failureCount += 1;

            return {
                name: serviceName,
                status: 'unhealthy',
                url: service.url,
                error: error.message,
                lastCheck: service.lastHealthCheck,
                failureCount: service.failureCount
            };
        }
    }

    // Verificar salud de todos los servicios
    async checkAllServicesHealth() {
        const healthPromises = Array.from(this.services.keys()).map(
            serviceName => this.checkServiceHealth(serviceName)
        );
        
        return await Promise.all(healthPromises);
    }

    // Marcar un servicio como no saludable
    markServiceUnhealthy(serviceName, error) {
        const service = this.services.get(serviceName);
        if (service) {
            service.status = 'unhealthy';
            service.failureCount += 1;
            service.lastError = error.message;
            service.lastHealthCheck = new Date().toISOString();
            
            logger.warn(`Servicio marcado como no saludable: ${serviceName} - ${error.message}`);
        }
    }

    // Obtener circuit breaker de un servicio
    getCircuitBreaker(serviceName) {
        return this.circuitBreakers.get(serviceName);
    }
}

module.exports = ServiceRegistry;
