import express from 'express';
import { ipcMain } from 'electron';
import { emulateInvoke } from './util.js';

class DebugServer {
  constructor(port = 3000) {
    this.app = express();
    this.port = port;
      this.host = "0.0.0.0"; // Add host property
    this.server = null;
    this.isRunning = false;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Middleware to parse JSON bodies
    this.app.use(express.json());
    
    // Middleware to parse URL-encoded bodies
    this.app.use(express.urlencoded({ extended: true }));
    
    this.app.use((req, res, next) => {
      req.timestamp = new Date().toISOString();
      console.log(`${req.method} ${req.path} - ${req.timestamp}`);
      next();
    });
  }

  setupRoutes() {

    // channels list
    this.app.get('/ipc/channels', (req, res) => {
      try {
        const channels = Array.from(ipcMain._invokeHandlers.keys());
        res.json({
          channels,
          count: channels.length,
          timestamp: req.timestamp
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get IPC channels',
          message: error.message,
          timestamp: req.timestamp
        });
      }
    });

    // invoke an ipc channel
    this.app.post('/ipc/invoke/:channel', async (req, res) => {
      const { channel } = req.params;
      const { args = [] } = req.body;

      try {
        const result = await emulateInvoke(channel, ...args);
        res.json({
          success: true,
          channel,
          args,
          result,
          timestamp: req.timestamp
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          channel,
          args,
          error: error.message,
          timestamp: req.timestamp
        });
      }
    });

    // Test connection
    this.app.get('/ipc/test', async (req, res) => {
      try {
        // List all available handlers
        const handlers = Array.from(ipcMain._invokeHandlers.keys());
        
        res.json({
          message: 'IPC test endpoint',
          availableHandlers: handlers,
          handlerCount: handlers.length,
          canEmulate: typeof emulateInvoke === 'function',
          timestamp: req.timestamp
        });
      } catch (error) {
        res.status(500).json({
          error: 'IPC test failed',
          message: error.message,
          timestamp: req.timestamp
        });
      }
    });

    // Get specific handler info
    this.app.get('/ipc/handler/:channel', (req, res) => {
      const { channel } = req.params;
      
      try {
        const hasHandler = ipcMain._invokeHandlers.has(channel);
        const handler = ipcMain._invokeHandlers.get(channel);
        
        res.json({
          channel,
          exists: hasHandler,
          handlerType: hasHandler ? typeof handler : null,
          timestamp: req.timestamp
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to get handler info',
          channel,
          message: error.message,
          timestamp: req.timestamp
        });
      }
    });
  }

  async start() {
    if (this.isRunning) {
      console.log(`DebugServer is already running on port ${this.port}`);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err) => {
        if (err) {
          console.error('Failed to start DebugServer:', err);
          reject(err);
        } else {
          this.isRunning = true;
        //   console.log(`🔧 IPC Handlers available: ${ipcMain._invokeHandlers.size}`);
          resolve();
        }
      });

      this.server.on('error', (err) => {
        console.error('DebugServer error:', err);
        this.isRunning = false;
        reject(err);
      });
    });
  }

  async stop() {
    if (!this.isRunning || !this.server) {
      console.log('DebugServer is not running');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          console.error('Error stopping DebugServer:', err);
          reject(err);
        } else {
          this.isRunning = false;
          this.server = null;
          resolve();
        }
      });
    });
  }

  getApp() {
    return this.app;
  }

  getPort() {
    return this.port;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      uptime: this.isRunning ? process.uptime() : 0,
      ipcHandlers: ipcMain._invokeHandlers.size
    };
  }

  // Helper method to test IPC invoke
  async testInvoke(channel, ...args) {
    try {
      return await emulateInvoke(channel, ...args);
    } catch (error) {
      console.error(`Failed to invoke ${channel}:`, error);
      throw error;
    }
  }
}

export default DebugServer;