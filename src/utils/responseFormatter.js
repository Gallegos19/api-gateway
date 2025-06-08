class ResponseFormatter {
    static success(data, message = 'Operación exitosa', meta = {}) {
        return {
            success: true,
            message,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                ...meta
            }
        };
    }

    static error(message, code = 'INTERNAL_ERROR', details = null, statusCode = 500) {
        const response = {
            success: false,
            error: {
                message,
                code,
                statusCode,
                timestamp: new Date().toISOString()
            }
        };

        if (details) {
            response.error.details = details;
        }

        return response;
    }

    static paginated(data, pagination) {
        return {
            success: true,
            data,
            pagination: {
                currentPage: pagination.page,
                totalPages: Math.ceil(pagination.total / pagination.limit),
                totalItems: pagination.total,
                itemsPerPage: pagination.limit,
                hasNextPage: pagination.page < Math.ceil(pagination.total / pagination.limit),
                hasPreviousPage: pagination.page > 1
            },
            meta: {
                timestamp: new Date().toISOString()
            }
        };
    }

    static created(data, message = 'Recurso creado exitosamente') {
        return {
            success: true,
            message,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                action: 'created'
            }
        };
    }

    static updated(data, message = 'Recurso actualizado exitosamente') {
        return {
            success: true,
            message,
            data,
            meta: {
                timestamp: new Date().toISOString(),
                action: 'updated'
            }
        };
    }

    static deleted(message = 'Recurso eliminado exitosamente') {
        return {
            success: true,
            message,
            meta: {
                timestamp: new Date().toISOString(),
                action: 'deleted'
            }
        };
    }
}

module.exports = ResponseFormatter;
