const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const ZERION_API = 'api.zerion.io';

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Proxy-Key');
  
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

  // Forward headers, including Authorization
  const forwardHeaders = {
    'Accept': req.headers['accept'] || 'application/json',
  };
  
  // Forward Authorization header if present
  if (req.headers['authorization']) {
    forwardHeaders['Authorization'] = req.headers['authorization'];
  }

  const options = {
    hostname: ZERION_API,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: forwardHeaders,
  };

  console.log(`Proxying: ${req.method} ${targetPath}`);

  const proxyReq = https.request(options, (proxyRes) => {
    // Add CORS to response
    const responseHeaders = {
      ...proxyRes.headers,
      'Access-Control-Allow-Origin': '*',
    };
    res.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    console.error('Proxy error:', e.message);
    res.writeHead(502);
    res.end(`Proxy error: ${e.message}`);
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`Zerion proxy listening on port ${PORT}`);
});
