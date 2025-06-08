const Joi = require('joi');
const { ValidationError } = require('../shared/errors/CustomErrors');

// Middleware genérico de validación
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const details = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            throw new ValidationError('Datos de entrada inválidos', { details });
        }

        // Reemplazar con datos validados y sanitizados
        req[property] = value;
        next();
    };
};

// Esquemas comunes de validación
const commonSchemas = {
    id: Joi.string().uuid().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
    pagination: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        sortBy: Joi.string().optional(),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })
};

module.exports = { validate, commonSchemas };