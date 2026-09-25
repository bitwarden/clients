// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LogLevelType } from "@bitwarden/common/platform/enums/log-level-type.enum";
import { ConsoleLogService as BaseConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { LogRecorder } from "@bitwarden/logging";

export class ConsoleLogService extends BaseConsoleLogService {
  constructor(
    isDev: boolean,
    filter: (level: LogLevelType) => boolean = null,
    recorder: LogRecorder = null,
  ) {
    super(isDev, filter, recorder);
  }

  write(level: LogLevelType, message?: any, ...optionalParams: any[]) {
    if (process.env.BW_RESPONSE !== "true") {
      super.write(level, message, ...optionalParams);
      return;
    }

    // Structured output owns stdout, so logs go to stderr instead.
    this.tee(level, message, ...optionalParams);

    if (this.filter != null && this.filter(level)) {
      return;
    }

    // eslint-disable-next-line
    console.error(message, ...optionalParams);
  }
}
