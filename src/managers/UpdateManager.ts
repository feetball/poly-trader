import axios from 'axios';
import { EventEmitter } from 'events';

export interface UpdateInfo {
    hasUpdate: boolean;
    latestVersion: string;
    downloadUrl: string;
    lastChecked?: number;
}

export class UpdateManager extends EventEmitter {
    private currentVersion: string;
    private repoOwner: string = "ent0n29"; 
    private repoName: string = "poly-trader"; 

    // Cached info from last check
    private latestInfo: UpdateInfo;
    private pollHandle: NodeJS.Timeout | null = null;

    constructor(currentVersion: string) {
        super();
        this.currentVersion = currentVersion;
        this.latestInfo = { hasUpdate: false, latestVersion: currentVersion, downloadUrl: "", lastChecked: Date.now() };
    }

    public async checkForUpdates(): Promise<UpdateInfo> {
        try {
            // Check GitHub releases
            const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
            const response = await axios.get(url, { timeout: 5000 });
            
            const latestVersion = response.data.tag_name.replace('v', '');
            const hasUpdate = this.compareVersions(latestVersion, this.currentVersion) > 0;
            
            const info: UpdateInfo = {
                hasUpdate,
                latestVersion,
                downloadUrl: response.data.html_url,
                lastChecked: Date.now()
            };

            this.latestInfo = info;
            this.emit('update', info);

            return info;
        } catch (error) {
            // console.error("Failed to check for updates:", error);
            // Return last known info, but update lastChecked
            this.latestInfo.lastChecked = Date.now();
            return this.latestInfo;
        }
    }

    public startPolling(intervalMs: number = 5 * 60 * 1000) {
        if (this.pollHandle) return; // already polling
        // Do an immediate check
        this.checkForUpdates().catch(() => {});
        this.pollHandle = setInterval(() => {
            this.checkForUpdates().catch(() => {});
        }, intervalMs);
    }

    public stopPolling() {
        if (this.pollHandle) {
            clearInterval(this.pollHandle);
            this.pollHandle = null;
        }
    }

    public getLatestInfo(): UpdateInfo {
        return this.latestInfo;
    }

    private compareVersions(v1: string, v2: string): number {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        return 0;
    }
}
