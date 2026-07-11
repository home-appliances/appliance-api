"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const auth_js_1 = __importDefault(require("./auth.js"));
const products_js_1 = __importDefault(require("./products.js"));
const categories_js_1 = __importDefault(require("./categories.js"));
const category_params_js_1 = __importDefault(require("./category-params.js"));
const crawler_js_1 = __importDefault(require("./crawler.js"));
const stats_js_1 = __importDefault(require("./stats.js"));
const users_js_1 = __importDefault(require("./users.js"));
const logs_js_1 = __importDefault(require("./logs.js"));
const settings_js_1 = __importDefault(require("./settings.js"));
const admin = new hono_1.Hono();
// 挂载各管理路由
admin.route('/', auth_js_1.default);
admin.route('/', products_js_1.default);
admin.route('/', categories_js_1.default);
admin.route('/', category_params_js_1.default);
admin.route('/', crawler_js_1.default);
admin.route('/', stats_js_1.default);
admin.route('/', users_js_1.default);
admin.route('/', logs_js_1.default);
admin.route('/', settings_js_1.default);
exports.default = admin;
