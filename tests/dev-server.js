import { createServer } from 'vite';

const server = await createServer({
  cacheDir: '.test-cache',
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
});

await server.listen();
