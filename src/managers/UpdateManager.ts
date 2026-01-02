import axios from 'axios';
import { EventEmitter } from 'events';

export class UpdateManager extends EventEmitter {
    private currentVersion: string;
    private repoOwner: string = "ent0n29"; 
    private repoName: string = "poly-trader"; 

    constructor(currentVersion: string) {
        super();
        this.currentVersion = currentVersion;
    }

    public async checkForUpdates(): Promise<{ hasUpdate: boolean, latestVersion: string, downloadUrl: string }> {
        try {
            // Check GitHub releases
            const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
            const response = await axios.get(url, { timeout: 5000 });
            
            const latestVersion = response.data.tag_name.replace('v', '');
            const hasUpdate = this.compareVersions(latestVersion, this.currentVersion) > 0;
            
            return {
                hasUpdate,
                latestVersion,
                downloadUrl: response.data.html_url
            };
        } catch (error) {
            // console.error("Failed to check for updates:", error);
            // Fail silently or return current version
            return { hasUpdate: false, latestVersion: this.currentVersion, downloadUrl: "" };
        }
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
