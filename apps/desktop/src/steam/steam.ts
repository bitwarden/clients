import { exec } from "child_process";

import find from "find-process";

import Timer from "../utils/timer";

import { TrayAccountView } from "./account";
import SteamPath from "./steam-path";
import SteamProcess from "./steam-runners.enum";

class Steam {
  constructor() {}

  static async login(account: TrayAccountView) {
    await this.logout();
    const steamDir = SteamPath.getSteamDir();
    console.log(steamDir);
    exec(
      `"${steamDir}" -login ${account.username} ${account.password}`,
      (_error: any, _stdout: any, _stderr: any) => {
        if (_error) {
          console.log(`Error: ${_error.message}`);
          return;
        }
        if (_stderr) {
          console.log(`stderr: ${_stderr}`);
          return;
        }
        console.log(`stdout: ${_stdout}`);
      }
    );
  }

  static async logout() {
    let hasExited = false;
    let attempts = 0;

    while (!hasExited && attempts < 10) {
      hasExited = await Steam.TryExit();
      attempts++;

      if (!hasExited) {
        await Timer.sleep(100);
        console.log("Waiting!");
      }
    }
  }

  private static async TryExit() {
    let didExit = false;
    await find("name", "steam").then(async function (list: any[]) {
      list.forEach(async (steamRunner: { name: string; ppid: number }) => {
        try {
          if (
            steamRunner.name == SteamProcess.Windows ||
            steamRunner.name == SteamProcess.Linux ||
            steamRunner.name == SteamProcess.WebHelper
          ) {
            didExit = true;
            process.kill(steamRunner.ppid, "SIGKILL");
          }
        } catch (error) {}
      });
    });
    return didExit;
  }
}

export default Steam;
