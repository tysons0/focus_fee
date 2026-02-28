// Local dev server for the API (no Vercel). Run with: npm run dev
import 'dotenv/config';
import http from 'node:http';
const PORT = Number(process.env.PORT) || 3000;

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = req.url || '/';
  const method = req.method || 'GET';

  // CORS headers for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url === '/api/invest' && method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed: unknown;
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const vercelReq = { method: 'POST', body: parsed } as { method: string; body: unknown };
    const vercelRes = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(obj: unknown) {
        res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      }
    };

    const handler = (await import('./api/invest.ts')).default;
    await handler(vercelReq, vercelRes);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
  console.log(`  POST /api/invest`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Kill the process or set PORT=3001 npm run dev`);
    process.exit(1);
  }
  throw err;
});
