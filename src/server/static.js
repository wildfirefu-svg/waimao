import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, relative, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

export function serveStatic(response, pathname) {
  const root = resolve('public');
  const requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const filePath = resolve(root, `.${requested}`);
  const relation = relative(root, filePath);
  if (relation.startsWith('..') || relation.includes(`..${sep}`) || resolve(relation) === relation) {
    return false;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;

  response.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
  return true;
}
