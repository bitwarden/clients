// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as path from "path";

import { ipcMain } from "electron";
import log from "electron-log/main";

import { LogLevelType } from "@bitwarden/common/platform/enums/log-level-type.enum";
import { ConsoleLogService as BaseLogService } from "@bitwarden/common/platform/services/console-log.service";
import { logging } from "@bitwarden/desktop-napi";

import { isDev } from "../../utils";

export class ElectronLogMainService extends BaseLogService {
  constructor(
    protected filter: (level: LogLevelType) => boolean = null,
    private logDir: string = null,
  ) {
    super(isDev(), filter);

    if (log.transports == null) {
      return;
    }

    log.transports.file.level = "info";
    if (this.logDir != null) {
      log.transports.file.resolvePathFn = () => path.join(this.logDir, "app.log");
    }
    log.initialize();

    ipcMain.handle("ipc.log", (_event, { level, message, optionalParams }) => {
      this.write(level, message, ...optionalParams);
    });

    logging.initNapiLog((error, level, message) => this.writeNapiLog(level, message));
  }

  private writeNapiLog(level: logging.LogLevel, message: string) {
    let levelType: LogLevelType;

    switch (level) {
      case logging.LogLevel.Debug:
        levelType = LogLevelType.Debug;
        break;
      case logging.LogLevel.Warn:
        levelType = LogLevelType.Warning;
        break;
      case logging.LogLevel.Error:
        levelType = LogLevelType.Error;
        break;
      default:
        levelType = LogLevelType.Info;
        break;
    }

    this.write(levelType, "[NAPI] " + message);
  }

  write(level: LogLevelType, message?: any, ...optionalParams: any[]) {
    if (this.filter != null && this.filter(level)) {
      return;
    }

    switch (level) {
      case LogLevelType.Debug:
        log.debug(message, ...optionalParams);
        break;
      case LogLevelType.Info:
        log.info(message, ...optionalParams);
        break;
      case LogLevelType.Warning:
        log.warn(message, ...optionalParams);
        break;
      case LogLevelType.Error:
        log.error(message, ...optionalParams);
        break;
      default:
        break;
    }
  }
}
