/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
// Support Zoho Catalyst (X_ZOHO_CATALYST_LISTEN_PORT), standard cloud PORT, or local default 3000
const port = parseInt(process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', engine: 'DedupeIQ' }));
        return;
      }

      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling request:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error: ' + ((err && (err.stack || err.message)) || String(err)));
      }
    }
  })
    .once('error', (err) => {
      console.error('Server failed to start:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> DedupeIQ Master Engine listening on http://${hostname}:${port}`);
    });
});
