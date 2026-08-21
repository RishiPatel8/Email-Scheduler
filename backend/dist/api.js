"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const yamljs_1 = __importDefault(require("yamljs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./config/env");
const error_1 = require("./middleware/error");
const logger_1 = require("./utils/logger");
// Import Routes
const auth_1 = __importDefault(require("./routes/auth"));
const campaign_1 = __importDefault(require("./routes/campaign"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: env_1.env.FRONTEND_URL, credentials: true }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Swagger Documentation
try {
    const swaggerDocument = yamljs_1.default.load(path_1.default.join(__dirname, '../../docs/openapi.yaml'));
    app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerDocument));
}
catch (e) {
    logger_1.logger.warn('Swagger documentation not found or failed to load.');
}
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/campaigns', campaign_1.default);
// Error Handling
app.use(error_1.errorHandler);
if (require.main === module) {
    app.listen(env_1.env.PORT, () => {
        logger_1.logger.info(`API Server running on port ${env_1.env.PORT}`);
    });
}
exports.default = app;
//# sourceMappingURL=api.js.map