require('dotenv').config();
const express = require('express');
const { config } = require('./src/config/services');
const setupRoutes = require('./src/config/routes');
const { setupMiddleware, setupErrorHandling } = require('./src/middleware');
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
            logger.info('🚀 Inicializando API Gateway...', {
                version: process.env.API_VERSION || '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                port: this.port
            });

            // 1. Configurar middlewares básicos PRIMERO
            setupMiddleware(this.app);
            logger.info('✅ Middlewares básicos configurados');

            // 2. Registrar servicios de microservicios
            await this.serviceRegistry.registerServices(config.services);
            logger.info('✅ Servicios registrados', {
                serviceCount: Object.keys(config.services).length,
                services: Object.keys(config.services)
            });

            // 3. Configurar rutas con proxy hacia microservicios
            setupRoutes(this.app, this.serviceRegistry);
            logger.info('✅ Rutas configuradas');

            // 4. 🔧 IMPORTANTE: Configurar manejo de errores DESPUÉS de las rutas
            setupErrorHandling(this.app);
            logger.info('✅ Manejo de errores configurado');

            // 5. Iniciar health checker para monitorear servicios
            this.healthChecker.startHealthChecks();
            logger.info('✅ Health checker iniciado');

            // 6. Verificar configuración de autenticación
            await this.validateAuthConfig();
            logger.info('✅ Configuración de autenticación validada');

            logger.info('🎉 API Gateway inicializado correctamente');
        } catch (error) {
            logger.error('❌ Error inicializando API Gateway:', {
                error: error.message,
                stack: error.stack
            });
            process.exit(1);
        }
    }

    async validateAuthConfig() {
        const { authConfig } = require('./src/config/auth');
        
        if (!authConfig.jwtSecret || authConfig.jwtSecret === 'tu_jwt_secret_super_seguro') {
            logger.warn('⚠️ Usando JWT_SECRET por defecto - CAMBIA EN PRODUCCIÓN');
        }

        if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET es requerido en producción');
        }

        logger.debug('Configuración de autenticación:', {
            jwtSecret: authConfig.jwtSecret ? 'configurado' : 'no configurado',
            publicRoutes: authConfig.publicRoutes.length,
            protectedRoutes: authConfig.protectedRoutes.length
        });
    }

    async start() {
        try {
            // Verificar health de servicios antes de iniciar
            await this.checkInitialServiceHealth();

            // Iniciar servidor
            this.server = this.app.listen(this.port, () => {
                this.logStartupInfo();
            });

            // Configurar manejo de señales
            this.setupGracefulShutdown();

        } catch (error) {
            logger.error('❌ Error iniciando servidor:', {
                error: error.message,
                stack: error.stack
            });
            process.exit(1);
        }
    }

    async checkInitialServiceHealth() {
        logger.info('🔍 Verificando salud inicial de servicios...');
        
        try {
            const healthChecks = await this.serviceRegistry.checkAllServicesHealth();
            const healthyServices = healthChecks.filter(check => check.status === 'healthy');
            const unhealthyServices = healthChecks.filter(check => check.status !== 'healthy');
            
            logger.info('📊 Estado inicial de servicios:', {
                total: healthChecks.length,
                healthy: healthyServices.length,
                unhealthy: unhealthyServices.length,
                healthyServices: healthyServices.map(s => s.name),
                unhealthyServices: unhealthyServices.map(s => s.name)
            });

            if (unhealthyServices.length > 0) {
                logger.warn('⚠️ Algunos servicios no están disponibles:', {
                    services: unhealthyServices.map(s => ({ 
                        name: s.name, 
                        error: s.error 
                    }))
                });
            }

        } catch (error) {
            logger.warn('⚠️ No se pudo verificar salud inicial de servicios:', {
                error: error.message
            });
        }
    }

    logStartupInfo() {
        const { authConfig } = require('./src/config/auth');
        
        logger.info('🎉 API Gateway ejecutándose exitosamente!', {
            port: this.port,
            environment: process.env.NODE_ENV || 'development',
            version: process.env.API_VERSION || '1.0.0',
            uptime: process.uptime()
        });

        logger.info('📋 URLs disponibles:', {
            health: `http://localhost:${this.port}/health`,
            healthServices: `http://localhost:${this.port}/health/services`,
            gatewayInfo: `http://localhost:${this.port}/api/gateway/info`,
            authVerify: `http://localhost:${this.port}/api/auth/verify`,
            routes: `http://localhost:${this.port}/api/gateway/routes`
        });

        logger.info('🔐 Rutas de autenticación configuradas:', {
            login: `POST /api/auth/login`,
            register: `POST /api/auth/register`,
            forgotPassword: `POST /api/auth/forgot-password`,
            resetPassword: `POST /api/auth/reset-password`
        });

        logger.info('🛡️ Configuración de seguridad:', {
            publicRoutes: authConfig.publicRoutes.length,
            protectedRoutes: authConfig.protectedRoutes ? authConfig.protectedRoutes.length : 0,
            jwtConfigured: !!authConfig.jwtSecret,
            environment: process.env.NODE_ENV || 'development'
        });

        // 🔧 AGREGADO: Log de servicios registrados
        const services = this.serviceRegistry.getAllServices();
        logger.info('🔗 Servicios registrados:', {
            total: services.length,
            services: services.map(s => ({
                name: s.name,
                url: s.url,
                status: s.status
            }))
        });

        if (process.env.NODE_ENV !== 'production') {
            logger.info('🔧 Modo desarrollo activo - logs adicionales habilitados');
        }
    }

    setupGracefulShutdown() {
        const gracefulShutdown = (signal) => {
            logger.info(`🛑 Señal ${signal} recibida - iniciando cierre graceful`, {
                signal,
                uptime: process.uptime()
            });

            // Detener health checker
            if (this.healthChecker) {
                this.healthChecker.stopHealthChecks();
                logger.info('✅ Health checker detenido');
            }

            // Limpiar service registry
            if (this.serviceRegistry) {
                this.serviceRegistry.destroy();
                logger.info('✅ Service registry limpiado');
            }

            // Cerrar servidor HTTP
            if (this.server) {
                this.server.close((err) => {
                    if (err) {
                        logger.error('❌ Error cerrando servidor HTTP:', err);
                        process.exit(1);
                    }
                    
                    logger.info('✅ Servidor HTTP cerrado exitosamente');
                    process.exit(0);
                });

                // Forzar cierre después de 10 segundos
                setTimeout(() => {
                    logger.warn('⚠️ Forzando cierre después de timeout');
                    process.exit(1);
                }, 10000);
            } else {
                process.exit(0);
            }
        };

        // Capturar señales de sistema
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Capturar errores no manejados
        process.on('uncaughtException', (error) => {
            logger.error('❌ Excepción no capturada:', {
                error: error.message,
                stack: error.stack
            });
            gracefulShutdown('UNCAUGHT_EXCEPTION');
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('❌ Promise rechazada no manejada:', {
                reason: reason?.message || reason,
                promise: promise.toString()
            });
            gracefulShutdown('UNHANDLED_REJECTION');
        });
    }

    // Método para obtener información del gateway
    getInfo() {
        const services = this.serviceRegistry.getAllServices();
        const memoryUsage = process.memoryUsage();
        
        return {
            name: 'E-commerce API Gateway',
            version: process.env.API_VERSION || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            uptime: process.uptime(),
            port: this.port,
            timestamp: new Date().toISOString(),
            services: services.map(service => ({
                name: service.name,
                url: service.url,
                status: service.status,
                lastHealthCheck: service.lastHealthCheck,
                failureCount: service.failureCount,
                circuitBreakerState: this.serviceRegistry.getCircuitBreaker(service.name)?.getState()?.state
            })),
            memory: {
                used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
            },
            statistics: this.serviceRegistry.getServicesStatistics()
        };
    }
}

// Iniciar el API Gateway
if (require.main === module) {
    const gateway = new APIGateway();
    gateway.start().catch(error => {
        logger.error('❌ Error fatal iniciando API Gateway:', error);
        process.exit(1);
    });
}

module.exports = APIGateway;