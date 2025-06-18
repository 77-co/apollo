import si from 'systeminformation';
import axios from 'axios';

export class SystemInfoManager {
    constructor() {
        this.hardcodedRepo = '77-co/apollo';
    }

    // WiFi Management Functions using systeminformation v5

    async getWiFiInterfaces() {
        try {
            const interfaces = await si.wifiInterfaces();
            return interfaces;
        } catch (error) {
            throw new Error(`Failed to get WiFi interfaces: ${error.message}`);
        }
    }

    async getWiFiConnections() {
        try {
            const connections = await si.wifiConnections();
            return connections;
        } catch (error) {
            throw new Error(`Failed to get WiFi connections: ${error.message}`);
        }
    }

    async getWiFiNetworks() {
        try {
            const networks = await si.wifiNetworks();
            return networks;
        } catch (error) {
            throw new Error(`Failed to get WiFi networks: ${error.message}`);
        }
    }

    // System Information Functions using systeminformation v5

    async getCPUInfo() {
        try {
            const cpu = await si.cpu();
            return {
                manufacturer: cpu.manufacturer,
                brand: cpu.brand,
                speed: cpu.speed, // Now returns numerical value in v5
                speedMin: cpu.speedMin, // pascalCase in v5
                speedMax: cpu.speedMax, // pascalCase in v5
                cores: cpu.cores,
                physicalCores: cpu.physicalCores,
                processors: cpu.processors,
                socket: cpu.socket,
                vendor: cpu.vendor,
                family: cpu.family,
                model: cpu.model,
                stepping: cpu.stepping,
                revision: cpu.revision,
                voltage: cpu.voltage,
                virtualization: cpu.virtualization, // New in v5
                flags: cpu.flags // Now part of cpu() in v5
            };
        } catch (error) {
            throw new Error(`Failed to get CPU info: ${error.message}`);
        }
    }

    async getMemoryInfo() {
        try {
            const [memory, memLayout] = await Promise.all([
                si.mem(),
                si.memLayout()
            ]);

            return {
                total: memory.total,
                free: memory.free,
                used: memory.used,
                active: memory.active,
                available: memory.available,
                buffers: memory.buffers,
                cached: memory.cached,
                slab: memory.slab,
                buffcache: memory.buffcache,
                writeback: memory.writeback, // New in v5
                dirty: memory.dirty, // New in v5
                layout: memLayout.map(mem => ({
                    size: mem.size,
                    bank: mem.bank,
                    type: mem.type,
                    clockSpeed: mem.clockSpeed,
                    formFactor: mem.formFactor,
                    manufacturer: mem.manufacturer,
                    partNum: mem.partNum,
                    serialNum: mem.serialNum,
                    voltageConfigured: mem.voltageConfigured,
                    voltageMin: mem.voltageMin,
                    voltageMax: mem.voltageMax,
                    ecc: mem.ecc // New in v5
                }))
            };
        } catch (error) {
            throw new Error(`Failed to get memory info: ${error.message}`);
        }
    }

    async getBatteryInfo() {
        try {
            const battery = await si.battery();
            return {
                hasBattery: battery.hasBattery, // pascalCase in v5
                cycleCount: battery.cycleCount, // pascalCase in v5
                isCharging: battery.isCharging, // pascalCase in v5
                designedCapacity: battery.designedCapacity, // pascalCase in v5
                maxCapacity: battery.maxCapacity, // pascalCase in v5
                currentCapacity: battery.currentCapacity,
                voltage: battery.voltage,
                capacityUnit: battery.capacityUnit,
                percent: battery.percent,
                timeRemaining: battery.timeRemaining, // pascalCase in v5
                acConnected: battery.acConnected, // pascalCase in v5
                type: battery.type,
                model: battery.model,
                manufacturer: battery.manufacturer,
                serial: battery.serial
            };
        } catch (error) {
            return null; // Battery info might not be available on all systems
        }
    }

    async getNetworkInfo() {
        try {
            const [interfaces, connections] = await Promise.all([
                si.networkInterfaces(),
                si.networkConnections()
            ]);

            return {
                interfaces: interfaces.map(iface => ({
                    iface: iface.iface,
                    ifaceName: iface.ifaceName,
                    ip4: iface.ip4,
                    ip4subnet: iface.ip4subnet,
                    ip6: iface.ip6,
                    ip6subnet: iface.ip6subnet,
                    mac: iface.mac,
                    internal: iface.internal,
                    virtual: iface.virtual,
                    operstate: iface.operstate,
                    type: iface.type,
                    duplex: iface.duplex,
                    mtu: iface.mtu,
                    speed: iface.speed,
                    dhcp: iface.dhcp,
                    dnsSuffix: iface.dnsSuffix,
                    ieee8021xAuth: iface.ieee8021xAuth,
                    ieee8021xState: iface.ieee8021xState,
                    carrierChanges: iface.carrierChanges // pascalCase in v5
                })),
                connections: connections.map(conn => ({
                    protocol: conn.protocol,
                    localAddress: conn.localAddress, // pascalCase in v5
                    localPort: conn.localPort, // pascalCase in v5
                    peerAddress: conn.peerAddress, // pascalCase in v5
                    peerPort: conn.peerPort, // pascalCase in v5
                    state: conn.state,
                    pid: conn.pid,
                    process: conn.process
                }))
            };
        } catch (error) {
            throw new Error(`Failed to get network info: ${error.message}`);
        }
    }

    async getUSBDevices() {
        try {
            const usbDevices = await si.usb(); // New in v5
            return usbDevices;
        } catch (error) {
            throw new Error(`Failed to get USB devices: ${error.message}`);
        }
    }

    async getBluetoothDevices() {
        try {
            const bluetoothDevices = await si.bluetoothDevices(); // New in v5
            return bluetoothDevices;
        } catch (error) {
            throw new Error(`Failed to get Bluetooth devices: ${error.message}`);
        }
    }

    async getAudioDevices() {
        try {
            const audio = await si.audio(); // New in v5
            return audio;
        } catch (error) {
            throw new Error(`Failed to get audio devices: ${error.message}`);
        }
    }

    async getCurrentLoad() {
        try {
            const load = await si.currentLoad();
            return {
                avgLoad: load.avgLoad, // pascalCase in v5
                currentLoad: load.currentLoad, // pascalCase in v5
                currentLoadUser: load.currentLoadUser, // pascalCase in v5
                currentLoadSystem: load.currentLoadSystem, // pascalCase in v5
                currentLoadNice: load.currentLoadNice, // pascalCase in v5
                currentLoadIdle: load.currentLoadIdle, // pascalCase in v5
                currentLoadIrq: load.currentLoadIrq, // pascalCase in v5
                rawCurrentLoad: load.rawCurrentLoad, // pascalCase in v5
                cpus: load.cpus
            };
        } catch (error) {
            throw new Error(`Failed to get current load: ${error.message}`);
        }
    }

    async getSystemStatus() {
        try {
            const [osInfo, uptime, currentLoad, memory, temp] = await Promise.all([
                si.osInfo(),
                si.time(),
                si.currentLoad(),
                si.mem(),
                si.cpuTemperature()
            ]);

            return {
                platform: osInfo.platform,
                distro: osInfo.distro,
                release: osInfo.release,
                hostname: osInfo.hostname,
                fqdn: osInfo.fqdn,
                arch: osInfo.arch,
                uptime: uptime.uptime,
                cpuLoad: currentLoad.currentLoad,
                memoryUsage: (memory.used / memory.total) * 100,
                temperature: temp.main || null,
                virtual: osInfo.hypervizor || null // New in v5 for Hyper-V detection
            };
        } catch (error) {
            throw new Error(`Failed to get system status: ${error.message}`);
        }
    }

    async getGraphicsInfo() {
        try {
            const graphics = await si.graphics();
            return {
                controllers: graphics.controllers.map(controller => ({
                    vendor: controller.vendor,
                    model: controller.model,
                    bus: controller.bus,
                    vram: controller.vram,
                    vramDynamic: controller.vramDynamic
                })),
                displays: graphics.displays.map(display => ({
                    vendor: display.vendor,
                    model: display.model,
                    main: display.main,
                    builtin: display.builtin,
                    connection: display.connection,
                    sizeX: display.sizeX, // pascalCase in v5
                    sizeY: display.sizeY, // pascalCase in v5
                    pixelDepth: display.pixelDepth, // pascalCase in v5
                    resolutionX: display.resolutionX, // pascalCase in v5
                    resolutionY: display.resolutionY, // pascalCase in v5
                    currentResX: display.currentResX,
                    currentResY: display.currentResY,
                    positionX: display.positionX,
                    positionY: display.positionY,
                    currentRefreshRate: display.currentRefreshRate
                }))
            };
        } catch (error) {
            throw new Error(`Failed to get graphics info: ${error.message}`);
        }
    }

    async getStorageInfo() {
        try {
            const [blockDevices, diskLayout, fsSize] = await Promise.all([
                si.blockDevices(),
                si.diskLayout(),
                si.fsSize()
            ]);

            return {
                blockDevices: blockDevices.map(device => ({
                    name: device.name,
                    type: device.type,
                    fsType: device.fsType, // pascalCase in v5
                    mount: device.mount,
                    size: device.size,
                    physical: device.physical,
                    uuid: device.uuid,
                    label: device.label,
                    model: device.model,
                    serial: device.serial,
                    removable: device.removable,
                    protocol: device.protocol
                })),
                diskLayout: diskLayout.map(disk => ({
                    device: disk.device,
                    type: disk.type,
                    name: disk.name,
                    vendor: disk.vendor,
                    size: disk.size,
                    bytesPerSector: disk.bytesPerSector,
                    totalCylinders: disk.totalCylinders,
                    totalHeads: disk.totalHeads,
                    totalSectors: disk.totalSectors,
                    totalTracks: disk.totalTracks,
                    tracksPerCylinder: disk.tracksPerCylinder,
                    sectorsPerTrack: disk.sectorsPerTrack,
                    firmwareRevision: disk.firmwareRevision,
                    serialNum: disk.serialNum,
                    interfaceType: disk.interfaceType,
                    smartStatus: disk.smartStatus
                })),
                fsSize: fsSize.map(fs => ({
                    fs: fs.fs,
                    type: fs.type,
                    size: fs.size,
                    used: fs.used,
                    available: fs.available, // New in v5
                    use: fs.use,
                    mount: fs.mount
                }))
            };
        } catch (error) {
            throw new Error(`Failed to get storage info: ${error.message}`);
        }
    }

    async getProcessInfo() {
        try {
            const [processes, services] = await Promise.all([
                si.processes(),
                si.services()
            ]);

            return {
                all: processes.all,
                running: processes.running,
                blocked: processes.blocked,
                sleeping: processes.sleeping,
                unknown: processes.unknown,
                list: processes.list.map(proc => ({
                    pid: proc.pid,
                    parentPid: proc.parentPid,
                    name: proc.name,
                    cpu: proc.cpu, // renamed from pcpu in v5
                    cpuu: proc.cpuu, // renamed from pcpuu in v5
                    cpus: proc.cpus, // renamed from pcpus in v5
                    mem: proc.mem, // renamed from pmem in v5
                    priority: proc.priority,
                    memVsz: proc.memVsz, // pascalCase in v5
                    memRss: proc.memRss, // pascalCase in v5
                    nice: proc.nice,
                    started: proc.started,
                    state: proc.state,
                    tty: proc.tty,
                    user: proc.user,
                    command: proc.command
                })),
                services: services.map(service => ({
                    name: service.name,
                    running: service.running,
                    startmode: service.startmode,
                    pids: service.pids,
                    cpu: service.cpu, // renamed from pcpu in v5
                    mem: service.mem // renamed from pmem in v5
                }))
            };
        } catch (error) {
            throw new Error(`Failed to get process info: ${error.message}`);
        }
    }

    // Git Repository Information using axios
    async getLatestCommitInfo() {
        try {
            const response = await axios.get(`https://api.github.com/repos/${this.hardcodedRepo}/commits?per_page=1`);
            
            if (response.data && response.data.length > 0) {
                const commit = response.data[0];
                return {
                    hash: commit.sha.substring(0, 7),
                    fullHash: commit.sha,
                    date: commit.commit.author.date,
                    message: commit.commit.message.split('\n')[0],
                    author: commit.commit.author.name,
                    email: commit.commit.author.email,
                    url: commit.html_url,
                    repository: this.hardcodedRepo
                };
            } else {
                throw new Error('No commits found');
            }
        } catch (error) {
            if (error.response) {
                throw new Error(`GitHub API error: ${error.response.status} - ${error.response.statusText}`);
            }
            throw new Error(`Failed to get latest commit info: ${error.message}`);
        }
    }

    async getRepositoryInfo() {
        try {
            const response = await axios.get(`https://api.github.com/repos/${this.hardcodedRepo}`);
            
            return {
                name: response.data.name,
                fullName: response.data.full_name,
                description: response.data.description,
                private: response.data.private,
                language: response.data.language,
                size: response.data.size,
                stargazersCount: response.data.stargazers_count,
                watchersCount: response.data.watchers_count,
                forksCount: response.data.forks_count,
                openIssuesCount: response.data.open_issues_count,
                defaultBranch: response.data.default_branch,
                createdAt: response.data.created_at,
                updatedAt: response.data.updated_at,
                pushedAt: response.data.pushed_at,
                homepage: response.data.homepage,
                cloneUrl: response.data.clone_url,
                sshUrl: response.data.ssh_url,
                owner: {
                    login: response.data.owner.login,
                    type: response.data.owner.type,
                    avatarUrl: response.data.owner.avatar_url
                }
            };
        } catch (error) {
            if (error.response) {
                throw new Error(`GitHub API error: ${error.response.status} - ${error.response.statusText}`);
            }
            throw new Error(`Failed to get repository info: ${error.message}`);
        }
    }

    async getComprehensiveSystemInfo() {
        try {
            const [
                systemStatus,
                cpuInfo,
                memoryInfo,
                batteryInfo,
                networkInfo,
                currentLoad,
                graphicsInfo,
                storageInfo,
                usbDevices,
                bluetoothDevices,
                audioDevices,
                wifiInterfaces,
                wifiConnections,
                latestCommit,
                repositoryInfo
            ] = await Promise.all([
                this.getSystemStatus(),
                this.getCPUInfo(),
                this.getMemoryInfo(),
                this.getBatteryInfo(),
                this.getNetworkInfo(),
                this.getCurrentLoad(),
                this.getGraphicsInfo(),
                this.getStorageInfo(),
                this.getUSBDevices(),
                this.getBluetoothDevices(),
                this.getAudioDevices(),
                this.getWiFiInterfaces(),
                this.getWiFiConnections(),
                this.getLatestCommitInfo().catch(() => null),
                this.getRepositoryInfo().catch(() => null)
            ]);

            return {
                system: systemStatus,
                cpu: cpuInfo,
                memory: memoryInfo,
                battery: batteryInfo,
                network: networkInfo,
                load: currentLoad,
                graphics: graphicsInfo,
                storage: storageInfo,
                devices: {
                    usb: usbDevices,
                    bluetooth: bluetoothDevices,
                    audio: audioDevices
                },
                wifi: {
                    interfaces: wifiInterfaces,
                    connections: wifiConnections
                },
                repository: {
                    info: repositoryInfo,
                    latestCommit: latestCommit
                }
            };
        } catch (error) {
            throw new Error(`Failed to generate comprehensive system info: ${error.message}`);
        }
    }

    // Repository Management
    setRepository(repository) {
        this.hardcodedRepo = repository;
    }

    getRepository() {
        return this.hardcodedRepo;
    }
}

export default SystemInfoManager;