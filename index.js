const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const PROXY_KEY = process.env.PROXY_KEY || '';

// Route configs
const ROUTES = {
  '/zerion': { 
    host: 'api.zerion.io', 
    rewrite: (path) => path 
  },
  '/ibkr': { 
    host: 'ndcdyn.interactivebrokers.com', 
    rewrite: (path) => '/AccountManagement/FlexWebService' + path 
  },
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Proxy-Key, User-Agent');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check (no auth required)
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
    return;
  }

  // Auth check
  if (PROXY_KEY && req.headers['x-proxy-key'] !== PROXY_KEY) {
    console.log(`Auth failed: got ${req.headers['x-proxy-key']}`);
    res.writeHead(401);
    res.end('Unauthorized');
    return;
  }

  // Find matching route
  let route = null;
  let targetPath = req.url;
  
  for (const [prefix, config] of Object.entries(ROUTES)) {
    if (req.url.startsWith(prefix)) {
      route = config;
      const remainder = req.url.slice(prefix.length) || '/';
      targetPath = config.rewrite(remainder);
      break;
    }
  }

  if (!route) {
    res.writeHead(404);
    res.end('Unknown route');
    return;
  }

  // Forward headers
  const forwardHeaders = {
    'Accept': req.headers['accept'] || '*/*',
    'Host': route.host,
    'User-Agent': req.headers['user-agent'] || 'Demeter/1.0',
  };
  
  if (req.headers['authorization']) {
    forwardHeaders['Authorization'] = req.headers['authorization'];
  }
  if (req.headers['content-type']) {
    forwardHeaders['Content-Type'] = req.headers['content-type'];
  }

  const options = {
    hostname: route.host,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: forwardHeaders,
  };

  console.log(`Proxying: ${req.method} https://${route.host}${targetPath}`);

  const proxyReq = https.request(options, (proxyRes) => {
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
  console.log(`Proxy listening on port ${PORT}`);
  console.log(`Routes: ${Object.keys(ROUTES).join(', ')}`);
  console.log(`Auth: ${PROXY_KEY ? 'enabled' : 'disabled'}`);
});
