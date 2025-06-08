const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { corsMiddleware } = require('./cors');
const { globalRateLimit } = require('./rateLimiting');
const { requestLogger } = require('./logging');
const { errorHandler } = require('./errorHandler');

const setupMiddleware = (app) => {
    // Seguridad
    app.use(helmet());
    
    // CORS
    app.use(corsMiddleware);
    
    // Parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    
    // Rate limiting global
    app.use(globalRateLimit);
    
    // Logging
    app.use(requestLogger);
    app.use(morgan('combined'));
    
    // Error handling (debe ir al final)
    app.use(errorHandler);
};

module.exports = { setupMiddleware };