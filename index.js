const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const ZERION_API = 'api.zerion.io';

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
    return;
  }

  // Proxy /zerion/* to api.zerion.io/*
  let targetPath = req.url;
  if (targetPath.startsWith('/zerion')) {
    targetPath = targetPath.replace('/zerion', '');
  }

  const options = {
    hostname: ZERION_API,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      ...req.headers,
      host: ZERION_API,
    },
  };
  delete options.headers['host'];

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*',
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    console.error('Proxy error:', e);
    res.writeHead(502);
    res.end('Proxy error');
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`Zerion proxy listening on port ${PORT}`);
});
