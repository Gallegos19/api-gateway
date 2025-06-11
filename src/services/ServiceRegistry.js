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
            instances: [config.url], // Array de URLs para load balancing futuro
            lastHealthCheck: null,
            status: 'unknown',
            failureCount: 0,
            registeredAt: new Date().toISOString()
        };

        this.services.set(name, service);
        
        // Crear circuit breaker para este servicio
        this.circuitBreakers.set(name, new CircuitBreaker({
            name: `${name}-circuit-breaker`,
            failureThreshold: 5,
            recoveryTimeout: 30000,
            monitoringPeriod: 10000,
            timeout: config.timeout || 30000,
            onStateChange: (stateData) => {
                logger.info(`Circuit Breaker ${name} cambió de estado: ${stateData.previousState} -> ${stateData.newState}`);
            }
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

    // 🔧 CORREGIDO: Obtener una instancia disponible de un servicio (con load balancing)
    getServiceInstance(serviceName) {
        const service = this.services.get(serviceName);
        
        if (!service) {
            logger.error(`Servicio no encontrado: ${serviceName}`);
            throw new Error(`Servicio ${serviceName} no encontrado`);
        }

        if (service.status === 'unhealthy') {
            logger.warn(`Servicio no saludable: ${serviceName}`);
            // En lugar de lanzar error, intentar de todos modos (el circuit breaker manejará esto)
        }

        // Verificar circuit breaker
        const circuitBreaker = this.circuitBreakers.get(serviceName);
        if (circuitBreaker && !circuitBreaker.isRequestAllowed()) {
            logger.warn(`Circuit breaker abierto para ${serviceName}`);
            throw new Error(`Servicio ${serviceName} temporalmente no disponible (Circuit Breaker abierto)`);
        }

        // 🚨 PROBLEMA CORREGIDO: Devolver la URL string, no el array
        try {
            const instance = this.loadBalancer.getNextInstance(service);
            logger.debug(`Instancia seleccionada para ${serviceName}: ${instance}`);
            return instance; // Esto debe ser una string URL, no un array
        } catch (error) {
            logger.error(`Error obteniendo instancia para ${serviceName}: ${error.message}`);
            
            // Fallback: devolver la primera URL disponible
            if (service.instances && service.instances.length > 0) {
                const fallbackUrl = service.instances[0];
                logger.warn(`Usando URL fallback para ${serviceName}: ${fallbackUrl}`);
                return fallbackUrl;
            }
            
            // Si no hay instancias, usar la URL base del servicio
            if (service.url) {
                logger.warn(`Usando URL base para ${serviceName}: ${service.url}`);
                return service.url;
            }
            
            throw new Error(`No hay instancias disponibles para ${serviceName}`);
        }
    }

    // Verificar salud de un servicio específico
    async checkServiceHealth(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            return null;
        }

        const startTime = Date.now();
        try {
            // Usar la URL base del servicio para health check
            const healthUrl = `${service.url}${service.healthPath}`;
            logger.debug(`Verificando salud de ${serviceName}: ${healthUrl}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(healthUrl, {
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

            // Actualizar estado del servicio
            service.status = isHealthy ? 'healthy' : 'unhealthy';
            service.lastHealthCheck = new Date().toISOString();
            service.lastResponseTime = responseTime;
            
            if (isHealthy) {
                service.failureCount = 0;
                // Notificar éxito al circuit breaker
                const circuitBreaker = this.circuitBreakers.get(serviceName);
                if (circuitBreaker) {
                    circuitBreaker.recordSuccess();
                }
            } else {
                service.failureCount = (service.failureCount || 0) + 1;
                // Notificar fallo al circuit breaker
                const circuitBreaker = this.circuitBreakers.get(serviceName);
                if (circuitBreaker) {
                    circuitBreaker.recordFailure(new Error(`Health check failed: HTTP ${response.status}`));
                }
            }

            return {
                name: serviceName,
                status: service.status,
                url: service.url,
                responseTime: `${responseTime}ms`,
                statusCode: response.status,
                lastCheck: service.lastHealthCheck,
                failureCount: service.failureCount
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            service.status = 'unhealthy';
            service.lastHealthCheck = new Date().toISOString();
            service.failureCount = (service.failureCount || 0) + 1;
            service.lastError = error.message;

            // Notificar fallo al circuit breaker
            const circuitBreaker = this.circuitBreakers.get(serviceName);
            if (circuitBreaker) {
                circuitBreaker.recordFailure(error);
            }

            logger.warn(`Health check falló para ${serviceName}: ${error.message}`);

            return {
                name: serviceName,
                status: 'unhealthy',
                url: service.url,
                error: error.message,
                responseTime: `${responseTime}ms`,
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
        
        const results = await Promise.allSettled(healthPromises);
        
        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                const serviceName = Array.from(this.services.keys())[index];
                return {
                    name: serviceName,
                    status: 'error',
                    error: result.reason?.message || 'Unknown error',
                    lastCheck: new Date().toISOString()
                };
            }
        }).filter(Boolean); // Filtrar nulls
    }

    // Marcar un servicio como no saludable
    markServiceUnhealthy(serviceName, error) {
        const service = this.services.get(serviceName);
        if (service) {
            service.status = 'unhealthy';
            service.failureCount = (service.failureCount || 0) + 1;
            service.lastError = error.message;
            service.lastHealthCheck = new Date().toISOString();
            
            // Notificar al circuit breaker
            const circuitBreaker = this.circuitBreakers.get(serviceName);
            if (circuitBreaker) {
                circuitBreaker.recordFailure(error);
            }
            
            logger.warn(`Servicio marcado como no saludable: ${serviceName} - ${error.message}`);
        }
    }

    // Marcar un servicio como saludable
    markServiceHealthy(serviceName) {
        const service = this.services.get(serviceName);
        if (service) {
            service.status = 'healthy';
            service.failureCount = 0;
            service.lastHealthCheck = new Date().toISOString();
            
            // Notificar al circuit breaker
            const circuitBreaker = this.circuitBreakers.get(serviceName);
            if (circuitBreaker) {
                circuitBreaker.recordSuccess();
            }
            
            logger.info(`Servicio marcado como saludable: ${serviceName}`);
        }
    }

    // Obtener circuit breaker de un servicio
    getCircuitBreaker(serviceName) {
        return this.circuitBreakers.get(serviceName);
    }

    // Obtener estadísticas de todos los servicios
    getServicesStatistics() {
        const services = this.getAllServices();
        const circuitBreakers = Array.from(this.circuitBreakers.entries());
        
        return {
            totalServices: services.length,
            healthyServices: services.filter(s => s.status === 'healthy').length,
            unhealthyServices: services.filter(s => s.status === 'unhealthy').length,
            unknownServices: services.filter(s => s.status === 'unknown').length,
            services: services.map(service => ({
                name: service.name,
                status: service.status,
                url: service.url,
                failureCount: service.failureCount,
                lastHealthCheck: service.lastHealthCheck,
                lastResponseTime: service.lastResponseTime,
                circuitBreakerState: this.circuitBreakers.get(service.name)?.getState()
            })),
            circuitBreakers: circuitBreakers.map(([name, cb]) => ({
                serviceName: name,
                ...cb.getState()
            }))
        };
    }

    // Resetear un servicio (para testing/admin)
    resetService(serviceName) {
        const service = this.services.get(serviceName);
        if (service) {
            service.status = 'unknown';
            service.failureCount = 0;
            service.lastError = null;
            service.lastHealthCheck = null;
            
            // Resetear circuit breaker
            const circuitBreaker = this.circuitBreakers.get(serviceName);
            if (circuitBreaker) {
                circuitBreaker.forceState('CLOSED');
            }
            
            logger.info(`Servicio reseteado: ${serviceName}`);
        }
    }

    // Limpiar recursos
    destroy() {
        // Destruir todos los circuit breakers
        this.circuitBreakers.forEach((cb, name) => {
            logger.debug(`Destruyendo circuit breaker para ${name}`);
            cb.destroy();
        });
        
        this.circuitBreakers.clear();
        this.services.clear();
        
        logger.info('ServiceRegistry destruido');
    }
}

module.exports = ServiceRegistry;