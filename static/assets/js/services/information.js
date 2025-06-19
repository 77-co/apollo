let isLoading = false;

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function updateElement(id, value, fallback = 'Błąd ładowania') {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value || fallback;
    }
}

async function updateSystemInfo() {
    try {
        const response = await window.backend.systeminfo.status.getSystem();
        
        if (response.success && response.data) {
            const data = response.data;
            updateElement('systemVersion', `ApolloOS 1.4.5`);
            
            try {
                const commitResponse = await window.backend.systeminfo.repository.getLatestCommit();
                if (commitResponse.success && commitResponse.data) {
                    const commit = commitResponse.data;
                    updateElement('buildInfo', `#${commit.hash} (${commit.date})`);
                }
            } catch (error) {
                updateElement('buildInfo', 'Apollo OS 2.1');
            }
        } else {
            throw new Error(response.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Failed to get system info:', error);
        updateElement('systemVersion', 'Apollo OS');
        updateElement('buildInfo', 'Apollo OS 2.1');
    }
}

async function updateCPUInfo() {
    try {
        const cpuResponse = await window.backend.systeminfo.hardware.getCPU();
        
        if (cpuResponse.success && cpuResponse.data) {
            const cpu = cpuResponse.data;
            updateElement('cpuInfo', `${cpu.manufacturer} ${cpu.brand}`);
        }
    } catch (error) {
        console.error('Failed to get CPU info:', error);
        updateElement('cpuInfo', 'Nieznany procesor');
    }
}

async function updateMemoryInfo() {
    try {
        const response = await window.backend.systeminfo.hardware.getMemory();
        
        if (response.success && response.data) {
            const memory = response.data;
            const totalGB = formatBytes(memory.total);
            updateElement('totalMemory', totalGB);
        }
    } catch (error) {
        console.error('Failed to get memory info:', error);
        updateElement('totalMemory', '4 GB');
    }
}


async function updateNetworkInfo() {
    try {
        const [networkResponse, wifiResponse] = await Promise.all([
            window.backend.systeminfo.network.getInfo(),
            window.backend.systeminfo.wifi.getConnections()
        ]);
        
        if (networkResponse.success && networkResponse.data && networkResponse.data.interfaces) {
            const activeInterface = networkResponse.data.interfaces.find(iface => 
                !iface.internal && iface.ip4 && iface.operstate === 'up'
            );
            
            if (activeInterface) {
                updateElement('deviceIpAddress', activeInterface.ip4);
                updateElement('macAddress', activeInterface.mac);
            }
        }

        if (wifiResponse.success && wifiResponse.data && wifiResponse.data.length > 0) {
            const activeWifi = wifiResponse.data.find(conn => conn.state === 'connected');
            if (activeWifi) {
                updateElement('activeNetwork', activeWifi.ssid || activeWifi.id || 'WiFi połączony');
            } else {
                updateElement('activeNetwork', 'Ethernet');
            }
        } else {
            updateElement('activeNetwork', 'Ethernet');
        }
    } catch (error) {
        console.error('Failed to get network info:', error);
        updateElement('deviceIpAddress', '192.168.1.100');
        updateElement('macAddress', 'AA:BB:CC:DD:EE:FF');
        updateElement('activeNetwork', 'Nieznana');
    }
}

async function loadAllInfo() {
    if (isLoading) return;
    isLoading = true;

    try {
        await Promise.all([
            updateSystemInfo(),
            updateCPUInfo(),
            updateMemoryInfo(),
            updateNetworkInfo()
        ]);
    } catch (error) {
        console.error('Failed to load device info:', error);
    } finally {
        isLoading = false;
    }
}

setTimeout(() => {
    if (window.backend) {
        loadAllInfo();
    }
}, 3000);