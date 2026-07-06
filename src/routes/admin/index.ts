import { Hono } from 'hono';
import auth from './auth.js';
import products from './products.js';
import crawler from './crawler.js';
import stats from './stats.js';
import users from './users.js';
import logs from './logs.js';
import settings from './settings.js';

const admin = new Hono();

// 挂载各管理路由
admin.route('/', auth);
admin.route('/', products);
admin.route('/', crawler);
admin.route('/', stats);
admin.route('/', users);
admin.route('/', logs);
admin.route('/', settings);

export default admin;
