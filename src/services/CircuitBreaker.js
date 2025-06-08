// ========================================
// 📁 src/services/CircuitBreaker.js - Circuit breaker completo para servicios
// ========================================
const logger = require('../utils/logger');
const { EventEmitter } = require('events');

/**
 * Estados del Circuit Breaker:
 * - CLOSED: Funcionamiento normal, permite todas las peticiones
 * - OPEN: Circuito abierto, rechaza todas las peticiones inmediatamente
 * - HALF_OPEN: Prueba si el servicio se ha recuperado
 */
const STATES = {
    CLOSED: 'CLOSED',
    OPEN: 'OPEN',
    HALF_OPEN: 'HALF_OPEN'
};

class CircuitBreaker extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuración del circuit breaker
        this.options = {
            failureThreshold: options.failureThreshold || 5,        // Número de fallos antes de abrir
            recoveryTimeout: options.recoveryTimeout || 60000,      // Tiempo antes de intentar recuperación (ms)
            monitoringPeriod: options.monitoringPeriod || 10000,    // Período de monitoreo (ms)
            successThreshold: options.successThreshold || 2,        // Éxitos consecutivos para cerrar en HALF_OPEN
            timeout: options.timeout || 30000,                      // Timeout para requests
            errorFilter: options.errorFilter || null,               // Función para filtrar qué errores cuentan
            onStateChange: options.onStateChange || null,           // Callback para cambios de estado
            name: options.name || 'CircuitBreaker'                  // Nombre para logging
        };
        
        // Estado interno
        this.state = STATES.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.totalRequests = 0;
        this.lastFailureTime = null;
        this.lastSuccessTime = null;
        this.nextAttemptTime = null;
        
        // Métricas por período
        this.metrics = {
            requests: 0,
            failures: 0,
            successes: 0,
            timeouts: 0,
            rejections: 0,
            averageResponseTime: 0,
            lastResetTime: Date.now()
        };
        
        // Timer para reset de métricas
        this.metricsTimer = setInterval(() => {
            this.resetMetrics();
        }, this.options.monitoringPeriod);
        
        // Listeners de estado
        this.stateChangeListeners = [];
        
        // Bind de métodos
        this.execute = this.execute.bind(this);
        this.call = this.call.bind(this);
        
        logger.info(`Circuit Breaker '${this.options.name}' inicializado`, {
            failureThreshold: this.options.failureThreshold,
            recoveryTimeout: this.options.recoveryTimeout,
            monitoringPeriod: this.options.monitoringPeriod
        });
    }

    /**
     * Ejecutar una función con circuit breaker
     * @param {Function} fn - Función async a ejecutar
     * @param {*} args - Argumentos para la función
     * @returns {Promise} Resultado de la función
     */
    async execute(fn, ...args) {
        return this.call(fn, ...args);
    }

    /**
     * Método principal para ejecutar requests con circuit breaker
     * @param {Function} fn - Función a ejecutar
     * @param {*} args - Argumentos
     * @returns {Promise} Resultado
     */
    async call(fn, ...args) {
        const startTime = Date.now();
        this.totalRequests++;
        this.metrics.requests++;

        // Verificar si se puede hacer el request
        if (!this.isRequestAllowed()) {
            this.metrics.rejections++;
            const error = new Error(`Circuit Breaker '${this.options.name}' está ${this.state}`);
            error.code = 'CIRCUIT_BREAKER_OPEN';
            error.circuitBreakerState = this.state;
            error.nextAttemptTime = this.nextAttemptTime;
            
            logger.warn(`Request rechazado por Circuit Breaker '${this.options.name}'`, {
                state: this.state,
                failureCount: this.failureCount,
                nextAttemptTime: this.nextAttemptTime
            });
            
            throw error;
        }

        // Si estamos en HALF_OPEN, solo permitir un request a la vez
        if (this.state === STATES.HALF_OPEN) {
            logger.info(`Circuit Breaker '${this.options.name}' en HALF_OPEN - Intentando request de prueba`);
        }

        try {
            // Ejecutar con timeout
            const result = await this.executeWithTimeout(fn, args);
            const responseTime = Date.now() - startTime;
            
            // Registrar éxito
            this.onSuccess(responseTime);
            
            return result;
        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            // Verificar si este error debe contar para el circuit breaker
            if (this.shouldRecordFailure(error)) {
                this.onFailure(error, responseTime);
            } else {
                logger.debug(`Error ignorado por Circuit Breaker '${this.options.name}': ${error.message}`);
            }
            
            throw error;
        }
    }

    /**
     * Ejecutar función con timeout
     * @param {Function} fn - Función a ejecutar
     * @param {Array} args - Argumentos
     * @returns {Promise} Resultado
     */
    async executeWithTimeout(fn, args) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.metrics.timeouts++;
                const error = new Error(`Timeout en Circuit Breaker '${this.options.name}' después de ${this.options.timeout}ms`);
                error.code = 'CIRCUIT_BREAKER_TIMEOUT';
                reject(error);
            }, this.options.timeout);

            try {
                const result = await fn(...args);
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Verificar si un error debe ser registrado como fallo
     * @param {Error} error - Error a verificar
     * @returns {boolean} Si debe contar como fallo
     */
    shouldRecordFailure(error) {
        if (this.options.errorFilter) {
            return this.options.errorFilter(error);
        }
        
        // Por defecto, todos los errores cuentan excepto algunos códigos específicos
        const ignoredCodes = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'CIRCUIT_BREAKER_TIMEOUT'];
        
        // Errores HTTP 4xx generalmente no deberían abrir el circuit breaker
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
            return false;
        }
        
        return !ignoredCodes.includes(error.code);
    }

    /**
     * Manejar éxito de request
     * @param {number} responseTime - Tiempo de respuesta
     */
    onSuccess(responseTime) {
        this.successCount++;
        this.metrics.successes++;
        this.lastSuccessTime = Date.now();
        
        // Actualizar tiempo promedio de respuesta
        this.updateAverageResponseTime(responseTime);
        
        logger.debug(`Circuit Breaker '${this.options.name}' - Éxito registrado`, {
            state: this.state,
            successCount: this.successCount,
            responseTime: `${responseTime}ms`
        });

        if (this.state === STATES.HALF_OPEN) {
            if (this.successCount >= this.options.successThreshold) {
                this.close();
            }
        } else if (this.state === STATES.CLOSED) {
            // Reset failure count en estado normal
            this.failureCount = 0;
        }

        this.emit('success', {
            responseTime,
            state: this.state,
            successCount: this.successCount
        });
    }

    /**
     * Manejar fallo de request
     * @param {Error} error - Error ocurrido
     * @param {number} responseTime - Tiempo hasta el fallo
     */
    onFailure(error, responseTime) {
        this.failureCount++;
        this.metrics.failures++;
        this.lastFailureTime = Date.now();
        
        logger.warn(`Circuit Breaker '${this.options.name}' - Fallo registrado`, {
            state: this.state,
            failureCount: this.failureCount,
            threshold: this.options.failureThreshold,
            error: error.message,
            responseTime: `${responseTime}ms`
        });

        if (this.state === STATES.HALF_OPEN) {
            // En HALF_OPEN, cualquier fallo vuelve a abrir el circuito
            this.open();
        } else if (this.state === STATES.CLOSED && this.failureCount >= this.options.failureThreshold) {
            // En CLOSED, abrir si se alcanza el threshold
            this.open();
        }

        this.emit('failure', {
            error,
            responseTime,
            state: this.state,
            failureCount: this.failureCount
        });
    }

    /**
     * Registrar fallo externo (desde health checker u otra fuente)
     * @param {Error} error - Error a registrar
     */
    recordFailure(error = new Error('External failure')) {
        if (this.shouldRecordFailure(error)) {
            this.onFailure(error, 0);
        }
    }

    /**
     * Registrar éxito externo
     */
    recordSuccess() {
        this.onSuccess(0);
    }

    /**
     * Abrir el circuit breaker
     */
    open() {
        const previousState = this.state;
        this.state = STATES.OPEN;
        this.nextAttemptTime = Date.now() + this.options.recoveryTimeout;
        
        logger.warn(`Circuit Breaker '${this.options.name}' ABIERTO`, {
            previousState,
            failureCount: this.failureCount,
            threshold: this.options.failureThreshold,
            nextAttemptTime: new Date(this.nextAttemptTime).toISOString()
        });

        this.notifyStateChange(previousState, STATES.OPEN);
        this.emit('open', this.getState());
    }

    /**
     * Cerrar el circuit breaker (reset completo)
     */
    close() {
        const previousState = this.state;
        this.state = STATES.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
        
        logger.info(`Circuit Breaker '${this.options.name}' CERRADO - Servicio recuperado`, {
            previousState
        });

        this.notifyStateChange(previousState, STATES.CLOSED);
        this.emit('close', this.getState());
    }

    /**
     * Cambiar a estado HALF_OPEN
     */
    halfOpen() {
        const previousState = this.state;
        this.state = STATES.HALF_OPEN;
        this.successCount = 0;
        
        logger.info(`Circuit Breaker '${this.options.name}' HALF_OPEN - Intentando recuperación`, {
            previousState
        });

        this.notifyStateChange(previousState, STATES.HALF_OPEN);
        this.emit('halfOpen', this.getState());
    }

    /**
     * Verificar si se debe intentar reset del circuito
     * @returns {boolean} Si se debe intentar reset
     */
    shouldAttemptReset() {
        return this.state === STATES.OPEN && 
               this.lastFailureTime && 
               (Date.now() - this.lastFailureTime) >= this.options.recoveryTimeout;
    }

    /**
     * Verificar si el circuit breaker permite requests
     * @returns {boolean} Si permite requests
     */
    isRequestAllowed() {
        switch (this.state) {
            case STATES.CLOSED:
                return true;
                
            case STATES.HALF_OPEN:
                return true;
                
            case STATES.OPEN:
                if (this.shouldAttemptReset()) {
                    this.halfOpen();
                    return true;
                }
                return false;
                
            default:
                return false;
        }
    }

    /**
     * Obtener estado completo del circuit breaker
     * @returns {Object} Estado actual
     */
    getState() {
        const now = Date.now();
        
        return {
            name: this.options.name,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            totalRequests: this.totalRequests,
            failureRate: this.totalRequests > 0 ? (this.failureCount / this.totalRequests) * 100 : 0,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            nextAttemptTime: this.nextAttemptTime,
            options: this.options,
            metrics: {
                ...this.metrics,
                uptime: now - (this.metrics.lastResetTime || now)
            },
            isHealthy: this.state === STATES.CLOSED,
            canMakeRequest: this.isRequestAllowed()
        };
    }

    /**
     * Obtener métricas actuales
     * @returns {Object} Métricas
     */
    getMetrics() {
        return {
            ...this.metrics,
            failureRate: this.metrics.requests > 0 ? (this.metrics.failures / this.metrics.requests) * 100 : 0,
            successRate: this.metrics.requests > 0 ? (this.metrics.successes / this.metrics.requests) * 100 : 0
        };
    }

    /**
     * Resetear métricas del período actual
     */
    resetMetrics() {
        const oldMetrics = { ...this.metrics };
        
        this.metrics = {
            requests: 0,
            failures: 0,
            successes: 0,
            timeouts: 0,
            rejections: 0,
            averageResponseTime: 0,
            lastResetTime: Date.now()
        };

        this.emit('metricsReset', oldMetrics);
    }

    /**
     * Actualizar tiempo promedio de respuesta
     * @param {number} responseTime - Nuevo tiempo de respuesta
     */
    updateAverageResponseTime(responseTime) {
        const totalResponses = this.metrics.successes;
        if (totalResponses === 1) {
            this.metrics.averageResponseTime = responseTime;
        } else {
            this.metrics.averageResponseTime = 
                ((this.metrics.averageResponseTime * (totalResponses - 1)) + responseTime) / totalResponses;
        }
    }

    /**
     * Agregar listener para cambios de estado
     * @param {Function} listener - Función callback
     */
    onStateChange(listener) {
        this.stateChangeListeners.push(listener);
    }

    /**
     * Remover listener de cambios de estado
     * @param {Function} listener - Función callback a remover
     */
    removeStateChangeListener(listener) {
        const index = this.stateChangeListeners.indexOf(listener);
        if (index > -1) {
            this.stateChangeListeners.splice(index, 1);
        }
    }

    /**
     * Notificar cambio de estado a todos los listeners
     * @param {string} previousState - Estado anterior
     * @param {string} newState - Nuevo estado
     */
    notifyStateChange(previousState, newState) {
        const stateData = {
            previousState,
            newState,
            timestamp: Date.now(),
            circuitBreaker: this.getState()
        };

        // Callback configurado en opciones
        if (this.options.onStateChange) {
            try {
                this.options.onStateChange(stateData);
            } catch (error) {
                logger.error(`Error en callback onStateChange para Circuit Breaker '${this.options.name}':`, error);
            }
        }

        // Listeners registrados
        this.stateChangeListeners.forEach(listener => {
            try {
                listener(stateData);
            } catch (error) {
                logger.error(`Error en listener de Circuit Breaker '${this.options.name}':`, error);
            }
        });

        this.emit('stateChange', stateData);
    }

    /**
     * Forzar cambio de estado (para testing o administración)
     * @param {string} newState - Nuevo estado
     */
    forceState(newState) {
        if (!Object.values(STATES).includes(newState)) {
            throw new Error(`Estado inválido: ${newState}`);
        }

        const previousState = this.state;
        this.state = newState;

        if (newState === STATES.CLOSED) {
            this.failureCount = 0;
            this.successCount = 0;
            this.nextAttemptTime = null;
        } else if (newState === STATES.OPEN) {
            this.nextAttemptTime = Date.now() + this.options.recoveryTimeout;
        }

        logger.warn(`Circuit Breaker '${this.options.name}' forzado a estado ${newState}`, {
            previousState
        });

        this.notifyStateChange(previousState, newState);
    }

    /**
     * Obtener estadísticas detalladas
     * @returns {Object} Estadísticas completas
     */
    getStatistics() {
        const now = Date.now();
        const state = this.getState();
        
        return {
            ...state,
            statistics: {
                uptimePercentage: this.calculateUptimePercentage(),
                meanTimeToRecovery: this.calculateMeanTimeToRecovery(),
                meanTimeBetweenFailures: this.calculateMeanTimeBetweenFailures(),
                totalDowntime: this.calculateTotalDowntime(),
                stateHistory: this.getStateHistory()
            }
        };
    }

    /**
     * Calcular porcentaje de uptime
     * @returns {number} Porcentaje de uptime
     */
    calculateUptimePercentage() {
        // Implementación simplificada - en producción usar métricas históricas
        if (this.state === STATES.CLOSED) return 100;
        if (this.state === STATES.OPEN) return 0;
        return 50; // HALF_OPEN
    }

    /**
     * Calcular tiempo medio hasta recuperación
     * @returns {number} MTTR en milisegundos
     */
    calculateMeanTimeToRecovery() {
        // Implementación simplificada
        return this.options.recoveryTimeout;
    }

    /**
     * Calcular tiempo medio entre fallos
     * @returns {number} MTBF en milisegundos
     */
    calculateMeanTimeBetweenFailures() {
        // Implementación simplificada
        return this.options.monitoringPeriod;
    }

    /**
     * Calcular tiempo total de inactividad
     * @returns {number} Downtime en milisegundos
     */
    calculateTotalDowntime() {
        // Implementación simplificada
        if (this.state === STATES.OPEN && this.lastFailureTime) {
            return Date.now() - this.lastFailureTime;
        }
        return 0;
    }

    /**
     * Obtener historial de estados (simplificado)
     * @returns {Array} Historial de cambios de estado
     */
    getStateHistory() {
        // En una implementación completa, esto mantendría un historial
        return [{
            state: this.state,
            timestamp: Date.now(),
            duration: 0
        }];
    }

    /**
     * Limpiar recursos (timers, listeners, etc.)
     */
    destroy() {
        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
            this.metricsTimer = null;
        }

        this.removeAllListeners();
        this.stateChangeListeners = [];

        logger.info(`Circuit Breaker '${this.options.name}' destruido`);
    }

    /**
     * Crear un wrapper de función con circuit breaker
     * @param {Function} fn - Función a wrappear
     * @returns {Function} Función con circuit breaker
     */
    wrap(fn) {
        return async (...args) => {
            return this.execute(fn, ...args);
        };
    }

    /**
     * Método toString para debugging
     * @returns {string} Representación string
     */
    toString() {
        return `CircuitBreaker(${this.options.name})[${this.state}] - Failures: ${this.failureCount}/${this.options.failureThreshold}`;
    }

    /**
     * Serializar estado para persistencia/monitoring
     * @returns {Object} Estado serializable
     */
    toJSON() {
        return this.getState();
    }
}

// Exportar también los estados para uso externo
CircuitBreaker.STATES = STATES;

module.exports = CircuitBreaker;