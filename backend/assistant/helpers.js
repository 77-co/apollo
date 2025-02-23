import { ipcMain } from 'electron';

export async function emulateInvoke(channel, ...args) {
    const handler = ipcMain._invokeHandlers.get(channel);
    if (!handler) {
        throw new Error(`No handler registered for channel: ${channel}`);
    }

    // `null` represents the `event` in the actual handler
    return handler(null, ...args);
} 