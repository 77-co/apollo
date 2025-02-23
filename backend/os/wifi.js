import { exec } from 'child_process';
import { platform } from 'os';

    // On windows, we supply dummy data
    // On Linux, we use wpa_cli and wpa_supplicant to manage WiFi

export class WiFiManager {
    constructor() {
        this.platform = platform();
        this.isWindows = this.platform === 'win32';
        if (this.isWindows) {
            console.log('WiFiManager will supply dummy data instead of executing actual commands.');
        }
    }

    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                resolve(stdout);
            });
        });
    }

    async listNetworks() {
        if (this.isWindows) {
            return [
                { ssid: 'Home-Network', signal: '90%', security: 'WPA2' },
                { ssid: 'Office-WiFi', signal: '75%', security: 'WPA2' },
                { ssid: 'Guest-Network', signal: '60%', security: 'None' },
                { ssid: 'Neighbor-5G', signal: '45%', security: 'WPA2' }
            ];
        }

        try {
            const scanCommand = 'sudo wpa_cli scan';
            const listCommand = 'sudo wpa_cli scan_results';
            
            await this.executeCommand(scanCommand);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const output = await this.executeCommand(listCommand);
            const networks = output.split('\n')
                .slice(1)
                .filter(line => line.trim())
                .map(line => {
                    const [bssid, frequency, signal, flags, ssid] = line.split('\t');
                    return {
                        ssid,
                        signal: Math.abs(parseInt(signal)) + '%',
                        security: flags.includes('WPA') ? 'WPA2' : 'None'
                    };
                });
            
            return networks;
        } catch (error) {
            throw new Error(`Failed to list networks: ${error.message}`);
        }
    }


    async connect(ssid, password = null) {
        if (this.isWindows) {

            await new Promise(resolve => setTimeout(resolve, 1500));
            return {
                success: true,
                message: `Connected to ${ssid} successfully`
            };
        }

        try {

            const networkConfig = password 
                ? `network={
                    ssid="${ssid}"
                    psk="${password}"
                    key_mgmt=WPA-PSK
                   }`
                : `network={
                    ssid="${ssid}"
                    key_mgmt=NONE
                   }`;

            await this.executeCommand(`echo '${networkConfig}' | sudo tee -a /etc/wpa_supplicant/wpa_supplicant.conf`);
            
            await this.executeCommand('sudo wpa_cli reconfigure');
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            

            const status = await this.executeCommand('sudo wpa_cli status');
            
            if (status.includes(ssid)) {
                return {
                    success: true,
                    message: `Connected to ${ssid} successfully`
                };
            } else {
                throw new Error('Connection failed');
            }
        } catch (error) {
            throw new Error(`Failed to connect: ${error.message}`);
        }
    }

    async disconnect() {
        if (this.isWindows) {
            return {
                success: true,
                message: 'Disconnected from network'
            };
        }

        try {
            await this.executeCommand('sudo wpa_cli disconnect');
            return {
                success: true,
                message: 'Disconnected from network'
            };
        } catch (error) {
            throw new Error(`Failed to disconnect: ${error.message}`);
        }
    }

    async getStatus() {
        if (this.isWindows) {
            return {
                connected: true,
                ssid: 'Home-Network',
                ipAddress: '192.168.1.100',
                signalStrength: '85%'
            };
        }

        try {
            const status = await this.executeCommand('sudo wpa_cli status');
            const ipInfo = await this.executeCommand('ip addr show wlan0');
            
            const ssid = status.match(/ssid=(.*)/)?.[1] || null;
            const ipAddress = ipInfo.match(/inet ([\d.]+)/)?.[1] || null;
            
            return {
                connected: !!ssid,
                ssid,
                ipAddress,
                signalStrength: status.match(/signal_level=(.*)/)?.[1] || null
            };
        } catch (error) {
            throw new Error(`Failed to get status: ${error.message}`);
        }
    }
}