import find from 'find-process';
import { exec } from 'child_process';
import Timer from "../utils/timer";
import { TrayAccountView } from './account';
import SteamPath from './steam-path';
import SteamProcess from './steam-runners.enum';

class Steam {
  constructor() {
  }

  public static async login(account: TrayAccountView) {
    await this.logout();
    let steamDir = SteamPath.getSteamDir();
    exec(`${steamDir} -login ${account.username} ${account.password}`, (_error: any, _stdout: any, _stderr: any) => {
    });
  }

  public static async logout() {
    let hasExited = false;
    while (hasExited == false) {
      hasExited = await Steam.TryExit();
      await Timer.sleep(100);
    }
  }

  private static async TryExit() {
    let didExit: boolean = false;
    await find('name', 'steam').then(async function (list: any[]) {
      list.forEach(async (steamRunner: { name: string; ppid: number; }) => {
        try {
          if (steamRunner.name == SteamProcess.Windows || steamRunner.name == SteamProcess.Linux || steamRunner.name == SteamProcess.WebHelper) {
            didExit = true;
            process.kill(steamRunner.ppid, 'SIGKILL');
          }
        } catch (error) {
        }
      });
    });
    return didExit;
  }
}

export default Steam;