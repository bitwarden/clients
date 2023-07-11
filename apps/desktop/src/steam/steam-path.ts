import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

class SteamPath {
    static CONFIG_PATH = "/config";
    static AVATAR_CACHE_PATH = "/avatarcache";
    static USER_VDF = "/loginusers.vdf";
    
    static STEAM_DIR = 'steamDir';
    static DEFAULT_STEAM_DIR = '\"C:\\Program Files\\Steam\\Steam.exe\"';
    static LINUX_DEFAULT_STEAM_DIR = 'steam';
    static MACOS_DEFAULT_STEAM_DIR = '/Applications/Steam.app';

    static getSteamDir() {
        const platform = os.platform();
        let steamDir;

        switch (platform) {
            case 'win32': {
                // Check for both 64-bit and 32-bit installation paths
                const programFiles = process.env['ProgramFiles(x86)'] || process.env.ProgramFiles;
                let steamPath = path.join(programFiles, 'Steam\\Steam.exe');
                
                if (!fs.existsSync(steamPath)) {
                    steamPath = path.join(programFiles.replace(' (x86)', ''), 'Steam\\Steam.exe');
                }

                if (!fs.existsSync(steamPath)) {
                    throw new Error(`Steam not found in default locations`);
                }
                
                steamDir = steamPath;
                break;
            }
            case 'linux': {
                steamDir = this.LINUX_DEFAULT_STEAM_DIR;
                break;
            }
            case 'darwin': {
                steamDir = this.MACOS_DEFAULT_STEAM_DIR;
                break;
            }
            default: {
                throw new Error(`Unsupported platform: ${platform}`);
            }
        }

        return steamDir;
    }
}

export default SteamPath;
