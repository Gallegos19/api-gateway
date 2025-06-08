const axios = require('axios');
const logger = require('./logger');

class HttpClient {
    constructor(serviceRegistry) {
        this.serviceRegistry = serviceRegistry;
        this.defaultTimeout = 30000;
        
        // Configurar interceptores globales
        this.setupInterceptors();
    }

    // Configurar interceptores de axios
    setupInterceptors() {
        // Interceptor de request
        axios.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: Date.now() };
                logger.debug(`HTTP Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error('Error en request HTTP:', error);
                return Promise.reject(error);
            }
        );

        // Interceptor de response
        axios.interceptors.response.use(
            (response) => {
                const duration = Date.now() - response.config.metadata.startTime;
                logger.debug(`HTTP Response: ${response.status} ${response.config.url} - ${duration}ms`);
                return response;
            },
            (error) => {
                if (error.config) {
                    const duration = Date.now() - error.config.metadata.startTime;
                    logger.error(`HTTP Error: ${error.response?.status || 'NETWORK_ERROR'} ${error.config.url} - ${duration}ms`);
                }
                return Promise.reject(error);
            }
        );
    }

    // Realizar request HTTP con circuit breaker
    async request(serviceName, options) {
        const service = this.serviceRegistry.getService(serviceName);
        if (!service) {
            throw new Error(`Servicio ${serviceName} no encontrado`);
        }

        const circuitBreaker = this.serviceRegistry.getCircuitBreaker(serviceName);
        if (!circuitBreaker.isRequestAllowed()) {
            throw new Error(`Circuit breaker abierto para ${serviceName}`);
        }

        try {
            const response = await circuitBreaker.execute(async () => {
                const serviceUrl = this.serviceRegistry.getServiceInstance(serviceName);
                
                return await axios({
                    ...options,
                    baseURL: serviceUrl,
                    timeout: options.timeout || service.timeout || this.defaultTimeout,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'API-Gateway-HttpClient/1.0',
                        ...options.headers
                    }
                });
            });

            return response.data;
        } catch (error) {
            this.serviceRegistry.markServiceUnhealthy(serviceName, error);
            throw error;
        }
    }

    // Métodos de conveniencia
    async get(serviceName, path, options = {}) {
        return this.request(serviceName, {
            method: 'GET',
            url: path,
            ...options
        });
    }

    async post(serviceName, path, data, options = {}) {
        return this.request(serviceName, {
            method: 'POST',
            url: path,
            data,
            ...options
        });
    }

    async put(serviceName, path, data, options = {}) {
        return this.request(serviceName, {
            method: 'PUT',
            url: path,
            data,
            ...options
        });
    }

    async delete(serviceName, path, options = {}) {
        return this.request(serviceName, {
            method: 'DELETE',
            url: path,
            ...options
        });
    }
}

module.exports = HttpClient;
