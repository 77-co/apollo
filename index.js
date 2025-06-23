import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup } from './backend/handlers.js';
import { app, BrowserWindow } from 'electron';
import 'dotenv/config';
import Store from 'electron-store';
import { platform } from 'os';
import DebugServer from './debugger/server.js';

const debugServer = new DebugServer(3000);

console.log("Detected platform: " + platform());

const store = new Store();
console.log(store.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'google-cloud-key.json');

// If we're working in a production environment
if (process.env.NODE_ENV === 'production') {
    // Ensure GPU acceleration is on.
    app.commandLine.appendSwitch('enable-gpu-rasterization');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('ignore-gpu-blacklist');
}

async function startDebugServer() {
    try {
        await debugServer.start();
        console.log('debugging server started on port', debugServer.port);
    } catch (error) {
        console.error('Failed to start DebugServer:', error);
    }
}

app.whenReady().then(async () => {
    const win = new BrowserWindow({
        width: 800,
        height: 480,
        // We want resizing for development (TRUST ME)
        resizable: process.env.NODE_ENV === 'production' ? false : true,
        backgroundColor: store.get('misc.darkTheme') ? '#131313' : '#ffffff',
        // If Node is running in production environment, launch the window in kiosk mode.
        kiosk: process.env.NODE_ENV === 'production',

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            media: true,
        },
    });
 
    setup(win);

    win.loadFile('./static/index.html');

    win.setAspectRatio(5 / 3);

    await startDebugServer();
});

app.on('before-quit', async (event) => {
    if (debugServer.getStatus().isRunning) {
        event.preventDefault();
        try {
            await debugServer.stop();
        } catch (error) {
            console.error('❌ Error stopping DebugServer:', error);
        } finally {
            app.quit();
        }
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        app.whenReady();
    }
});

app.on('window-all-closed', async () => {
    if (process.platform !== 'darwin') {
        if (debugServer.getStatus().isRunning) {
            try {
                await debugServer.stop();
            } catch (error) {
                console.error('Error stopping DebugServer during shutdown:', error);
            }
        }
        app.quit();
    }
});
