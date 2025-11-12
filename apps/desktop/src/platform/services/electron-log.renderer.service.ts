// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LogLevelType } from "@bitwarden/common/platform/enums/log-level-type.enum";
import { ConsoleLogService as BaseLogService } from "@bitwarden/common/platform/services/console-log.service";

export class ElectronLogRendererService extends BaseLogService {
  constructor() {
    super(ipc.platform.isDev, null, null);
  }

  write(level: LogLevelType, message?: any, ...optionalParams: any[]) {
    if (this.filter != null && this.filter(level)) {
      return;
    }

    /* eslint-disable no-console */
    ipc.platform
      .log(level, message, ...optionalParams)
      .catch((e) => console.log("Error logging", e));

    /* eslint-disable no-console */
    switch (level) {
      case LogLevelType.Debug:
        console.debug(message, ...optionalParams);
        break;
      case LogLevelType.Info:
        console.info(message, ...optionalParams);
        break;
      case LogLevelType.Warning:
        console.warn(message, ...optionalParams);
        break;
      case LogLevelType.Error:
        console.error(message, ...optionalParams);
        break;
      default:
        break;
    }
  }
}
