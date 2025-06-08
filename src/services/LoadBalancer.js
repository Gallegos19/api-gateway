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

    // Obtener la siguiente instancia disponible
    getNextInstance(service, algorithm = 'roundRobin') {
        if (!service.instances || service.instances.length === 0) {
            throw new Error(`No hay instancias disponibles para el servicio ${service.name}`);
        }

        // Filtrar solo instancias saludables
        const healthyInstances = service.instances.filter(instance => {
            // Aquí puedes agregar lógica para verificar si la instancia está saludable
            return true; // Por simplicidad, asumimos que todas están saludables
        });

        if (healthyInstances.length === 0) {
            throw new Error(`No hay instancias saludables para el servicio ${service.name}`);
        }

        const selectedAlgorithm = this.algorithms[algorithm] || this.algorithms.roundRobin;
        return selectedAlgorithm(service, healthyInstances);
    }

    // Algoritmo Round Robin
    roundRobin(service, instances) {
        if (!this.currentIndices.has(service.name)) {
            this.currentIndices.set(service.name, 0);
        }

        const currentIndex = this.currentIndices.get(service.name);
        const selectedInstance = instances[currentIndex];
        
        // Actualizar índice para la siguiente vez
        this.currentIndices.set(service.name, (currentIndex + 1) % instances.length);
        
        return selectedInstance;
    }

    // Algoritmo Least Connections
    leastConnections(service, instances) {
        let minConnections = Infinity;
        let selectedInstance = instances[0];

        instances.forEach(instance => {
            const connections = this.connectionCounts.get(instance) || 0;
            if (connections < minConnections) {
                minConnections = connections;
                selectedInstance = instance;
            }
        });

        return selectedInstance;
    }

    // Algoritmo Weighted
    weighted(service, instances) {
        // Implementación simple basada en peso
        const weights = instances.map(() => service.weight || 1);
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        const random = Math.random() * totalWeight;
        
        let currentWeight = 0;
        for (let i = 0; i < instances.length; i++) {
            currentWeight += weights[i];
            if (random <= currentWeight) {
                return instances[i];
            }
        }
        
        return instances[0];
    }

    // Algoritmo Random
    random(service, instances) {
        const randomIndex = Math.floor(Math.random() * instances.length);
        return instances[randomIndex];
    }

    // Incrementar contador de conexiones
    incrementConnections(instance) {
        const current = this.connectionCounts.get(instance) || 0;
        this.connectionCounts.set(instance, current + 1);
    }

    // Decrementar contador de conexiones
    decrementConnections(instance) {
        const current = this.connectionCounts.get(instance) || 0;
        this.connectionCounts.set(instance, Math.max(0, current - 1));
    }
}

module.exports = LoadBalancer;