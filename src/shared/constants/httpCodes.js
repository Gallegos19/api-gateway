// ========================================
// 📁 src/shared/constants/httpCodes.js - Códigos HTTP completos
// ========================================

/**
 * Códigos de estado HTTP estándar
 * Referencia: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
 */

// ========================================
// 1xx - Respuestas informativas
// ========================================
const INFORMATIONAL = {
    CONTINUE: 100,
    SWITCHING_PROTOCOLS: 101,
    PROCESSING: 102,
    EARLY_HINTS: 103
};

// ========================================
// 2xx - Respuestas satisfactorias
// ========================================
const SUCCESS = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NON_AUTHORITATIVE_INFORMATION: 203,
    NO_CONTENT: 204,
    RESET_CONTENT: 205,
    PARTIAL_CONTENT: 206,
    MULTI_STATUS: 207,
    ALREADY_REPORTED: 208,
    IM_USED: 226
};

// ========================================
// 3xx - Redirecciones
// ========================================
const REDIRECTION = {
    MULTIPLE_CHOICES: 300,
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    SEE_OTHER: 303,
    NOT_MODIFIED: 304,
    USE_PROXY: 305,
    TEMPORARY_REDIRECT: 307,
    PERMANENT_REDIRECT: 308
};

// ========================================
// 4xx - Errores del cliente
// ========================================
const CLIENT_ERROR = {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    PAYMENT_REQUIRED: 402,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    NOT_ACCEPTABLE: 406,
    PROXY_AUTHENTICATION_REQUIRED: 407,
    REQUEST_TIMEOUT: 408,
    CONFLICT: 409,
    GONE: 410,
    LENGTH_REQUIRED: 411,
    PRECONDITION_FAILED: 412,
    PAYLOAD_TOO_LARGE: 413,
    URI_TOO_LONG: 414,
    UNSUPPORTED_MEDIA_TYPE: 415,
    RANGE_NOT_SATISFIABLE: 416,
    EXPECTATION_FAILED: 417,
    IM_A_TEAPOT: 418,
    MISDIRECTED_REQUEST: 421,
    UNPROCESSABLE_ENTITY: 422,
    LOCKED: 423,
    FAILED_DEPENDENCY: 424,
    TOO_EARLY: 425,
    UPGRADE_REQUIRED: 426,
    PRECONDITION_REQUIRED: 428,
    TOO_MANY_REQUESTS: 429,
    REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
    UNAVAILABLE_FOR_LEGAL_REASONS: 451
};

// ========================================
// 5xx - Errores del servidor
// ========================================
const SERVER_ERROR = {
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504,
    HTTP_VERSION_NOT_SUPPORTED: 505,
    VARIANT_ALSO_NEGOTIATES: 506,
    INSUFFICIENT_STORAGE: 507,
    LOOP_DETECTED: 508,
    NOT_EXTENDED: 510,
    NETWORK_AUTHENTICATION_REQUIRED: 511
};

// ========================================
// Todos los códigos HTTP en un objeto
// ========================================
const HTTP_STATUS = {
    // 1xx Informational
    ...INFORMATIONAL,
    
    // 2xx Success
    ...SUCCESS,
    
    // 3xx Redirection
    ...REDIRECTION,
    
    // 4xx Client Error
    ...CLIENT_ERROR,
    
    // 5xx Server Error
    ...SERVER_ERROR
};

// ========================================
// Mensajes descriptivos para cada código
// ========================================
const HTTP_MESSAGES = {
    // 1xx Informational
    [HTTP_STATUS.CONTINUE]: 'Continue',
    [HTTP_STATUS.SWITCHING_PROTOCOLS]: 'Switching Protocols',
    [HTTP_STATUS.PROCESSING]: 'Processing',
    [HTTP_STATUS.EARLY_HINTS]: 'Early Hints',
    
    // 2xx Success
    [HTTP_STATUS.OK]: 'OK',
    [HTTP_STATUS.CREATED]: 'Created',
    [HTTP_STATUS.ACCEPTED]: 'Accepted',
    [HTTP_STATUS.NON_AUTHORITATIVE_INFORMATION]: 'Non-Authoritative Information',
    [HTTP_STATUS.NO_CONTENT]: 'No Content',
    [HTTP_STATUS.RESET_CONTENT]: 'Reset Content',
    [HTTP_STATUS.PARTIAL_CONTENT]: 'Partial Content',
    [HTTP_STATUS.MULTI_STATUS]: 'Multi-Status',
    [HTTP_STATUS.ALREADY_REPORTED]: 'Already Reported',
    [HTTP_STATUS.IM_USED]: 'IM Used',
    
    // 3xx Redirection
    [HTTP_STATUS.MULTIPLE_CHOICES]: 'Multiple Choices',
    [HTTP_STATUS.MOVED_PERMANENTLY]: 'Moved Permanently',
    [HTTP_STATUS.FOUND]: 'Found',
    [HTTP_STATUS.SEE_OTHER]: 'See Other',
    [HTTP_STATUS.NOT_MODIFIED]: 'Not Modified',
    [HTTP_STATUS.USE_PROXY]: 'Use Proxy',
    [HTTP_STATUS.TEMPORARY_REDIRECT]: 'Temporary Redirect',
    [HTTP_STATUS.PERMANENT_REDIRECT]: 'Permanent Redirect',
    
    // 4xx Client Error
    [HTTP_STATUS.BAD_REQUEST]: 'Bad Request',
    [HTTP_STATUS.UNAUTHORIZED]: 'Unauthorized',
    [HTTP_STATUS.PAYMENT_REQUIRED]: 'Payment Required',
    [HTTP_STATUS.FORBIDDEN]: 'Forbidden',
    [HTTP_STATUS.NOT_FOUND]: 'Not Found',
    [HTTP_STATUS.METHOD_NOT_ALLOWED]: 'Method Not Allowed',
    [HTTP_STATUS.NOT_ACCEPTABLE]: 'Not Acceptable',
    [HTTP_STATUS.PROXY_AUTHENTICATION_REQUIRED]: 'Proxy Authentication Required',
    [HTTP_STATUS.REQUEST_TIMEOUT]: 'Request Timeout',
    [HTTP_STATUS.CONFLICT]: 'Conflict',
    [HTTP_STATUS.GONE]: 'Gone',
    [HTTP_STATUS.LENGTH_REQUIRED]: 'Length Required',
    [HTTP_STATUS.PRECONDITION_FAILED]: 'Precondition Failed',
    [HTTP_STATUS.PAYLOAD_TOO_LARGE]: 'Payload Too Large',
    [HTTP_STATUS.URI_TOO_LONG]: 'URI Too Long',
    [HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE]: 'Unsupported Media Type',
    [HTTP_STATUS.RANGE_NOT_SATISFIABLE]: 'Range Not Satisfiable',
    [HTTP_STATUS.EXPECTATION_FAILED]: 'Expectation Failed',
    [HTTP_STATUS.IM_A_TEAPOT]: "I'm a teapot",
    [HTTP_STATUS.MISDIRECTED_REQUEST]: 'Misdirected Request',
    [HTTP_STATUS.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
    [HTTP_STATUS.LOCKED]: 'Locked',
    [HTTP_STATUS.FAILED_DEPENDENCY]: 'Failed Dependency',
    [HTTP_STATUS.TOO_EARLY]: 'Too Early',
    [HTTP_STATUS.UPGRADE_REQUIRED]: 'Upgrade Required',
    [HTTP_STATUS.PRECONDITION_REQUIRED]: 'Precondition Required',
    [HTTP_STATUS.TOO_MANY_REQUESTS]: 'Too Many Requests',
    [HTTP_STATUS.REQUEST_HEADER_FIELDS_TOO_LARGE]: 'Request Header Fields Too Large',
    [HTTP_STATUS.UNAVAILABLE_FOR_LEGAL_REASONS]: 'Unavailable For Legal Reasons',
    
    // 5xx Server Error
    [HTTP_STATUS.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
    [HTTP_STATUS.NOT_IMPLEMENTED]: 'Not Implemented',
    [HTTP_STATUS.BAD_GATEWAY]: 'Bad Gateway',
    [HTTP_STATUS.SERVICE_UNAVAILABLE]: 'Service Unavailable',
    [HTTP_STATUS.GATEWAY_TIMEOUT]: 'Gateway Timeout',
    [HTTP_STATUS.HTTP_VERSION_NOT_SUPPORTED]: 'HTTP Version Not Supported',
    [HTTP_STATUS.VARIANT_ALSO_NEGOTIATES]: 'Variant Also Negotiates',
    [HTTP_STATUS.INSUFFICIENT_STORAGE]: 'Insufficient Storage',
    [HTTP_STATUS.LOOP_DETECTED]: 'Loop Detected',
    [HTTP_STATUS.NOT_EXTENDED]: 'Not Extended',
    [HTTP_STATUS.NETWORK_AUTHENTICATION_REQUIRED]: 'Network Authentication Required'
};

// ========================================
// Mensajes en español para respuestas de API
// ========================================
const HTTP_MESSAGES_ES = {
    // 1xx Informational
    [HTTP_STATUS.CONTINUE]: 'Continuar',
    [HTTP_STATUS.SWITCHING_PROTOCOLS]: 'Cambiando Protocolos',
    [HTTP_STATUS.PROCESSING]: 'Procesando',
    [HTTP_STATUS.EARLY_HINTS]: 'Pistas Tempranas',
    
    // 2xx Success
    [HTTP_STATUS.OK]: 'Éxito',
    [HTTP_STATUS.CREATED]: 'Creado',
    [HTTP_STATUS.ACCEPTED]: 'Aceptado',
    [HTTP_STATUS.NON_AUTHORITATIVE_INFORMATION]: 'Información No Autoritativa',
    [HTTP_STATUS.NO_CONTENT]: 'Sin Contenido',
    [HTTP_STATUS.RESET_CONTENT]: 'Reiniciar Contenido',
    [HTTP_STATUS.PARTIAL_CONTENT]: 'Contenido Parcial',
    [HTTP_STATUS.MULTI_STATUS]: 'Multi-Estado',
    [HTTP_STATUS.ALREADY_REPORTED]: 'Ya Reportado',
    [HTTP_STATUS.IM_USED]: 'IM Usado',
    
    // 3xx Redirection
    [HTTP_STATUS.MULTIPLE_CHOICES]: 'Múltiples Opciones',
    [HTTP_STATUS.MOVED_PERMANENTLY]: 'Movido Permanentemente',
    [HTTP_STATUS.FOUND]: 'Encontrado',
    [HTTP_STATUS.SEE_OTHER]: 'Ver Otro',
    [HTTP_STATUS.NOT_MODIFIED]: 'No Modificado',
    [HTTP_STATUS.USE_PROXY]: 'Usar Proxy',
    [HTTP_STATUS.TEMPORARY_REDIRECT]: 'Redirección Temporal',
    [HTTP_STATUS.PERMANENT_REDIRECT]: 'Redirección Permanente',
    
    // 4xx Client Error
    [HTTP_STATUS.BAD_REQUEST]: 'Petición Incorrecta',
    [HTTP_STATUS.UNAUTHORIZED]: 'No Autorizado',
    [HTTP_STATUS.PAYMENT_REQUIRED]: 'Pago Requerido',
    [HTTP_STATUS.FORBIDDEN]: 'Prohibido',
    [HTTP_STATUS.NOT_FOUND]: 'No Encontrado',
    [HTTP_STATUS.METHOD_NOT_ALLOWED]: 'Método No Permitido',
    [HTTP_STATUS.NOT_ACCEPTABLE]: 'No Aceptable',
    [HTTP_STATUS.PROXY_AUTHENTICATION_REQUIRED]: 'Autenticación de Proxy Requerida',
    [HTTP_STATUS.REQUEST_TIMEOUT]: 'Timeout de Petición',
    [HTTP_STATUS.CONFLICT]: 'Conflicto',
    [HTTP_STATUS.GONE]: 'Ya No Existe',
    [HTTP_STATUS.LENGTH_REQUIRED]: 'Longitud Requerida',
    [HTTP_STATUS.PRECONDITION_FAILED]: 'Precondición Falló',
    [HTTP_STATUS.PAYLOAD_TOO_LARGE]: 'Carga Útil Muy Grande',
    [HTTP_STATUS.URI_TOO_LONG]: 'URI Muy Larga',
    [HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE]: 'Tipo de Media No Soportado',
    [HTTP_STATUS.RANGE_NOT_SATISFIABLE]: 'Rango No Satisfactorio',
    [HTTP_STATUS.EXPECTATION_FAILED]: 'Expectativa Falló',
    [HTTP_STATUS.IM_A_TEAPOT]: 'Soy una Tetera',
    [HTTP_STATUS.MISDIRECTED_REQUEST]: 'Petición Mal Dirigida',
    [HTTP_STATUS.UNPROCESSABLE_ENTITY]: 'Entidad No Procesable',
    [HTTP_STATUS.LOCKED]: 'Bloqueado',
    [HTTP_STATUS.FAILED_DEPENDENCY]: 'Dependencia Falló',
    [HTTP_STATUS.TOO_EARLY]: 'Muy Temprano',
    [HTTP_STATUS.UPGRADE_REQUIRED]: 'Actualización Requerida',
    [HTTP_STATUS.PRECONDITION_REQUIRED]: 'Precondición Requerida',
    [HTTP_STATUS.TOO_MANY_REQUESTS]: 'Demasiadas Peticiones',
    [HTTP_STATUS.REQUEST_HEADER_FIELDS_TOO_LARGE]: 'Campos de Cabecera Muy Grandes',
    [HTTP_STATUS.UNAVAILABLE_FOR_LEGAL_REASONS]: 'No Disponible por Razones Legales',
    
    // 5xx Server Error
    [HTTP_STATUS.INTERNAL_SERVER_ERROR]: 'Error Interno del Servidor',
    [HTTP_STATUS.NOT_IMPLEMENTED]: 'No Implementado',
    [HTTP_STATUS.BAD_GATEWAY]: 'Gateway Incorrecto',
    [HTTP_STATUS.SERVICE_UNAVAILABLE]: 'Servicio No Disponible',
    [HTTP_STATUS.GATEWAY_TIMEOUT]: 'Timeout del Gateway',
    [HTTP_STATUS.HTTP_VERSION_NOT_SUPPORTED]: 'Versión HTTP No Soportada',
    [HTTP_STATUS.VARIANT_ALSO_NEGOTIATES]: 'Variante También Negocia',
    [HTTP_STATUS.INSUFFICIENT_STORAGE]: 'Almacenamiento Insuficiente',
    [HTTP_STATUS.LOOP_DETECTED]: 'Bucle Detectado',
    [HTTP_STATUS.NOT_EXTENDED]: 'No Extendido',
    [HTTP_STATUS.NETWORK_AUTHENTICATION_REQUIRED]: 'Autenticación de Red Requerida'
};

// ========================================
// Funciones utilitarias
// ========================================

/**
 * Verificar si un código es de éxito (2xx)
 * @param {number} statusCode - Código de estado
 * @returns {boolean} Si es código de éxito
 */
const isSuccess = (statusCode) => {
    return statusCode >= 200 && statusCode < 300;
};

/**
 * Verificar si un código es de error del cliente (4xx)
 * @param {number} statusCode - Código de estado
 * @returns {boolean} Si es error del cliente
 */
const isClientError = (statusCode) => {
    return statusCode >= 400 && statusCode < 500;
};

/**
 * Verificar si un código es de error del servidor (5xx)
 * @param {number} statusCode - Código de estado
 * @returns {boolean} Si es error del servidor
 */
const isServerError = (statusCode) => {
    return statusCode >= 500 && statusCode < 600;
};

/**
 * Verificar si un código es de redirección (3xx)
 * @param {number} statusCode - Código de estado
 * @returns {boolean} Si es redirección
 */
const isRedirection = (statusCode) => {
    return statusCode >= 300 && statusCode < 400;
};

/**
 * Verificar si un código es informativo (1xx)
 * @param {number} statusCode - Código de estado
 * @returns {boolean} Si es informativo
 */
const isInformational = (statusCode) => {
    return statusCode >= 100 && statusCode < 200;
};

/**
 * Obtener el mensaje para un código de estado
 * @param {number} statusCode - Código de estado
 * @param {string} language - Idioma ('en' o 'es')
 * @returns {string} Mensaje descriptivo
 */
const getMessage = (statusCode, language = 'en') => {
    const messages = language === 'es' ? HTTP_MESSAGES_ES : HTTP_MESSAGES;
    return messages[statusCode] || `Unknown Status Code: ${statusCode}`;
};

/**
 * Obtener información completa de un código de estado
 * @param {number} statusCode - Código de estado
 * @param {string} language - Idioma ('en' o 'es')
 * @returns {Object} Información del código
 */
const getStatusInfo = (statusCode, language = 'en') => {
    return {
        code: statusCode,
        message: getMessage(statusCode, language),
        category: getCategory(statusCode),
        isSuccess: isSuccess(statusCode),
        isClientError: isClientError(statusCode),
        isServerError: isServerError(statusCode),
        isRedirection: isRedirection(statusCode),
        isInformational: isInformational(statusCode)
    };
};

/**
 * Obtener la categoría de un código de estado
 * @param {number} statusCode - Código de estado
 * @returns {string} Categoría del código
 */
const getCategory = (statusCode) => {
    if (isInformational(statusCode)) return 'Informational';
    if (isSuccess(statusCode)) return 'Success';
    if (isRedirection(statusCode)) return 'Redirection';
    if (isClientError(statusCode)) return 'Client Error';
    if (isServerError(statusCode)) return 'Server Error';
    return 'Unknown';
};

// ========================================
// Códigos más comunes para fácil acceso
// ========================================
const COMMON_STATUS = {
    // Más usados en APIs
    OK: HTTP_STATUS.OK,
    CREATED: HTTP_STATUS.CREATED,
    NO_CONTENT: HTTP_STATUS.NO_CONTENT,
    BAD_REQUEST: HTTP_STATUS.BAD_REQUEST,
    UNAUTHORIZED: HTTP_STATUS.UNAUTHORIZED,
    FORBIDDEN: HTTP_STATUS.FORBIDDEN,
    NOT_FOUND: HTTP_STATUS.NOT_FOUND,
    CONFLICT: HTTP_STATUS.CONFLICT,
    UNPROCESSABLE_ENTITY: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    TOO_MANY_REQUESTS: HTTP_STATUS.TOO_MANY_REQUESTS,
    INTERNAL_SERVER_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    SERVICE_UNAVAILABLE: HTTP_STATUS.SERVICE_UNAVAILABLE
};

// ========================================
// Exportaciones
// ========================================
module.exports = {
    // Códigos por categoría
    INFORMATIONAL,
    SUCCESS,
    REDIRECTION,
    CLIENT_ERROR,
    SERVER_ERROR,
    
    // Todos los códigos
    HTTP_STATUS,
    
    // Mensajes
    HTTP_MESSAGES,
    HTTP_MESSAGES_ES,
    
    // Códigos comunes
    COMMON_STATUS,
    
    // Funciones utilitarias
    isSuccess,
    isClientError,
    isServerError,
    isRedirection,
    isInformational,
    getMessage,
    getStatusInfo,
    getCategory
};