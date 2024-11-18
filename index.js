import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup } from './backend/handlers.js';
import { app, BrowserWindow } from 'electron';
import 'dotenv/config';
import Store from 'electron-store';

const store = new Store();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'google-cloud-key.json');

// If we're working in a production environment
if (process.env.NODE_ENV === 'production') {
    // Ensure GPU acceleration is on.
    app.commandLine.appendSwitch('enable-gpu-rasterization');
    app.commandLine.appendSwitch('disable-software-rasterizer');
    app.commandLine.appendSwitch('ignore-gpu-blacklist');
}

app.whenReady().then(() => {
    const win = new BrowserWindow({
        width: 800,
        height: 480,
        resizable: false,
        backgroundColor: store.get('misc.darkTheme') ? '#131313' : '#ffffff',
        // If Node is running in production environment, launch the window in kiosk mode.
        kiosk: process.env.NODE_ENV === 'production',

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    setup(win);

    win.loadFile('./static/index.html');
});