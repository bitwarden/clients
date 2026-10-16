// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LogLevelType } from "@bitwarden/common/platform/enums/log-level-type.enum";
import { ConsoleLogService as BaseLogService } from "@bitwarden/common/platform/services/console-log.service";
import { LogRecorder } from "@bitwarden/logging";

export class ElectronLogRendererService extends BaseLogService {
  constructor(
    protected filter: (level: LogLevelType) => boolean = null,
    recorder: LogRecorder = null,
  ) {
    super(ipc.platform.isDev, filter, recorder);
  }

  write(level: LogLevelType, message?: any, ...optionalParams: any[]) {
    super.write(level, message, ...optionalParams);

    if (this.filter != null && this.filter(level)) {
      return;
    }

    ipc.platform
      .log(level, message, ...optionalParams)
      // eslint-disable-next-line no-console
      .catch((e) => console.log("Error logging", e));
  }
}
