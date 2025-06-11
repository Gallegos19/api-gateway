const logger = require('../utils/logger');

class LoadBalancer {
    constructor() {
        this.algorithms = {
            roundRobin: this.roundRobin.bind(this),
            leastConnections: this.leastConnections.bind(this),
            weighted: this.weighted.bind(this),
            random: this.random.bind(this)
        };
        this.currentIndices = new Map();
        this.connectionCounts = new Map();
    }

    // 🔧 CORREGIDO: Obtener la siguiente instancia disponible
    getNextInstance(service, algorithm = 'roundRobin') {
        if (!service) {
            throw new Error('Servicio no proporcionado al load balancer');
        }

        if (!service.instances || service.instances.length === 0) {
            logger.error(`No hay instancias disponibles para el servicio ${service.name}`, {
                service: service.name,
                instances: service.instances
            });
            throw new Error(`No hay instancias disponibles para el servicio ${service.name}`);
        }

        // 🚨 PROBLEMA CORREGIDO: Filtrar solo instancias saludables y válidas
        const healthyInstances = service.instances.filter(instance => {
            // Verificar que la instancia sea una string válida (URL)
            if (typeof instance !== 'string' || !instance.trim()) {
                logger.warn(`Instancia inválida detectada para ${service.name}:`, instance);
                return false;
            }

            // Verificar que sea una URL válida
            try {
                new URL(instance);
                return true;
            } catch (error) {
                logger.warn(`URL inválida para ${service.name}: ${instance}`);
                return false;
            }
        });

        if (healthyInstances.length === 0) {
            logger.error(`No hay instancias saludables para el servicio ${service.name}`, {
                service: service.name,
                totalInstances: service.instances.length,
                instances: service.instances
            });
            throw new Error(`No hay instancias saludables para el servicio ${service.name}`);
        }

        const selectedAlgorithm = this.algorithms[algorithm] || this.algorithms.roundRobin;
        const selectedInstance = selectedAlgorithm(service, healthyInstances);

        logger.debug(`Load balancer seleccionó instancia para ${service.name}: ${selectedInstance}`, {
            algorithm,
            totalInstances: healthyInstances.length,
            selectedInstance
        });

        return selectedInstance;
    }

    // Algoritmo Round Robin
    roundRobin(service, instances) {
        if (!this.currentIndices.has(service.name)) {
            this.currentIndices.set(service.name, 0);
        }

        const currentIndex = this.currentIndices.get(service.name);
        const selectedInstance = instances[currentIndex];
        
        // Actualizar índice para la siguiente vez
        const nextIndex = (currentIndex + 1) % instances.length;
        this.currentIndices.set(service.name, nextIndex);
        
        logger.debug(`Round Robin para ${service.name}: índice ${currentIndex} -> ${nextIndex}`, {
            currentIndex,
            nextIndex,
            totalInstances: instances.length,
            selectedInstance
        });
        
        return selectedInstance;
    }

    // Algoritmo Least Connections
    leastConnections(service, instances) {
        let minConnections = Infinity;
        let selectedInstance = instances[0];

        instances.forEach(instance => {
            const connectionKey = `${service.name}:${instance}`;
            const connections = this.connectionCounts.get(connectionKey) || 0;
            
            if (connections < minConnections) {
                minConnections = connections;
                selectedInstance = instance;
            }
        });

        logger.debug(`Least Connections para ${service.name}: ${selectedInstance} (${minConnections} conexiones)`, {
            selectedInstance,
            connections: minConnections
        });

        return selectedInstance;
    }

    // Algoritmo Weighted (basado en peso del servicio)
    weighted(service, instances) {
        // Usar el peso del servicio o peso por defecto
        const serviceWeight = service.weight || 1;
        const weights = instances.map(() => serviceWeight);
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        
        if (totalWeight === 0) {
            // Fallback a round robin si no hay pesos
            return this.roundRobin(service, instances);
        }
        
        const random = Math.random() * totalWeight;
        let currentWeight = 0;
        
        for (let i = 0; i < instances.length; i++) {
            currentWeight += weights[i];
            if (random <= currentWeight) {
                logger.debug(`Weighted para ${service.name}: ${instances[i]} (peso: ${weights[i]})`, {
                    selectedInstance: instances[i],
                    weight: weights[i],
                    totalWeight
                });
                return instances[i];
            }
        }
        
        // Fallback
        return instances[0];
    }

    // Algoritmo Random
    random(service, instances) {
        const randomIndex = Math.floor(Math.random() * instances.length);
        const selectedInstance = instances[randomIndex];
        
        logger.debug(`Random para ${service.name}: ${selectedInstance} (índice ${randomIndex})`, {
            randomIndex,
            totalInstances: instances.length,
            selectedInstance
        });
        
        return selectedInstance;
    }

    // Incrementar contador de conexiones
    incrementConnections(serviceName, instance) {
        const connectionKey = `${serviceName}:${instance}`;
        const current = this.connectionCounts.get(connectionKey) || 0;
        this.connectionCounts.set(connectionKey, current + 1);
        
        logger.debug(`Conexiones incrementadas para ${connectionKey}: ${current + 1}`);
    }

    // Decrementar contador de conexiones
    decrementConnections(serviceName, instance) {
        const connectionKey = `${serviceName}:${instance}`;
        const current = this.connectionCounts.get(connectionKey) || 0;
        const newCount = Math.max(0, current - 1);
        this.connectionCounts.set(connectionKey, newCount);
        
        logger.debug(`Conexiones decrementadas para ${connectionKey}: ${newCount}`);
    }

    // Obtener estadísticas de conexiones
    getConnectionStats() {
        const stats = {};
        
        for (const [key, count] of this.connectionCounts.entries()) {
            const [serviceName, instance] = key.split(':');
            
            if (!stats[serviceName]) {
                stats[serviceName] = {};
            }
            
            stats[serviceName][instance] = count;
        }
        
        return stats;
    }

    // Resetear estadísticas
    resetStats() {
        this.currentIndices.clear();
        this.connectionCounts.clear();
        logger.info('Estadísticas del load balancer reseteadas');
    }

    // Obtener información de estado
    getState() {
        return {
            algorithms: Object.keys(this.algorithms),
            currentIndices: Object.fromEntries(this.currentIndices),
            connectionCounts: this.getConnectionStats(),
            totalConnections: Array.from(this.connectionCounts.values()).reduce((sum, count) => sum + count, 0)
        };
    }
}

module.exports = LoadBalancer;