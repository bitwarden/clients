// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as path from "path";

import { ipcMain } from "electron";
import log from "electron-log/main";

import { LogLevelType } from "@bitwarden/common/platform/enums/log-level-type.enum";
import { ConsoleLogService as BaseLogService } from "@bitwarden/common/platform/services/console-log.service";
import { logging } from "@bitwarden/desktop-napi";

import { isDev } from "../../utils";

const EPIPE_ERROR_CODE = "EPIPE";

export class ElectronLogMainService extends BaseLogService {
  constructor(
    protected filter: (level: LogLevelType) => boolean = null,
    private logDir: string = null,
  ) {
    super(isDev(), filter);

    if (log.transports == null) {
      return;
    }

    this.guardConsoleAgainstClosedPipe();

    log.transports.file.level = isDev() ? "debug" : "info";
    if (this.logDir != null) {
      log.transports.file.resolvePathFn = () => path.join(this.logDir, "app.log");
    }
    log.initialize();

    ipcMain.handle("ipc.log", (_event, { level, message, optionalParams }) => {
      this.write(level, message, ...optionalParams);
    });

    logging.initNapiLog((error, level, message) => this.writeNapiLog(level, message));
  }

  // stdout/stderr may be a pipe owned by whatever launched the app (a terminal,
  // an updater, a parent process). Once that pipe is gone, console writes throw
  // EPIPE, which Electron surfaces to the user as an uncaught exception dialog
  // during shutdown. Console logs are best-effort, so drop them instead.
  private guardConsoleAgainstClosedPipe() {
    const consoleTransport = log.transports.console;
    const write = consoleTransport.writeFn;

    consoleTransport.writeFn = (options) => {
      try {
        write.call(consoleTransport, options);
      } catch (e) {
        if (e?.code !== EPIPE_ERROR_CODE) {
          throw e;
        }
      }
    };
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
