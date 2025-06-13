import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { initializeDatabase } from './database.js';
import { openSourceRoutes } from './routes/openSource.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// Initialize database
initializeDatabase();

// Middleware
app.use(cors({
  origin: 'https://svreport.luminousindia.com',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

app.use(express.json());

// API Routes (local)
app.use('/api', openSourceRoutes);

// Proxy middleware for external API
const proxyOptions = {
  target: 'https://svscan.luminousindia.com',
  changeOrigin: true,
  secure: true,
  timeout: 30000,
  proxyTimeout: 30000,
  onProxyReq: (proxyReq, req, res) => {
    // Add authentication header if available
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
    
    // Add required headers
    proxyReq.setHeader('Accept', 'application/json');
    proxyReq.setHeader('Content-Type', 'application/json');
    
    // If there's a body, write it to the proxy request
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Add CORS headers to proxied responses
    proxyRes.headers['Access-Control-Allow-Origin'] = req.headers.origin || '*';
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
  },
  onError: (err, req, res) => {
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Proxy error occurred', 
        message: err.message,
        url: req.url 
      });
    }
  }
};

// Apply proxy to all /api routes
app.use('/api', createProxyMiddleware(proxyOptions));

// Development mode - proxy to Vite dev server
if (process.env.NODE_ENV !== 'production') {
  console.log('🔧 Development mode: Proxying to Vite dev server');
  app.use('/', createProxyMiddleware({
    target: 'http://localhost:5173',
    changeOrigin: true,
    ws: true, // Enable WebSocket for HMR
  }));
} else {
  // Production mode - serve static files
  console.log('🚀 Production mode: Serving static files from dist');
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));

  // Handle React Router - send all non-API requests to index.html
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found', path: req.path });
    }
    
    // For all other routes, serve the React app
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).json({ error: 'Failed to serve application' });
      }
    });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});