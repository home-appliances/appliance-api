/**
 * 本地静态图片：GET /local-images/*
 * 文件根目录：~/Desktop/crawler_test/images-data/
 */
import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import { mimeFromExt, resolveLocalImagePath } from '../utils/image-local.js';

const localImages = new Hono();

localImages.get('/local-images/*', async (c) => {
  const reqPath = c.req.path; // /local-images/xxx.jpg
  const filePath = resolveLocalImagePath(reqPath);
  if (!filePath) {
    return c.json({ code: 404, message: '本地图片不存在' }, 404);
  }

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  return c.body(buf, 200, {
    'Content-Type': mimeFromExt(ext),
    'Cache-Control': 'public, max-age=86400',
  });
});

export default localImages;
