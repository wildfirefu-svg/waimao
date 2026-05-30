import { createServer } from 'node:http';
import { config } from '../config.js';
import { migrate, openDatabase } from '../db/database.js';
import { handleApi } from './api.js';
import { notFound, sendJson } from './router.js';
import { serveStatic } from './static.js';

const db = openDatabase(config.databasePath);
migrate(db);

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(request, response, db, url);
      if (handled === false) notFound(response);
      return;
    }

    if (serveStatic(response, url.pathname)) return;
    notFound(response);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(config.port, () => {
  console.log(`Hengda CRM running at http://localhost:${config.port}`);
});
