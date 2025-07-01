import { LogLevel } from "./log-level";
import { LogService } from "./log.service";

export class ConsoleLogService implements LogService {
  protected timersMap: Map<string, [number, number]> = new Map();

  constructor(
    protected isDev: boolean,
    protected filter: ((level: LogLevel) => boolean) | null = null,
  ) {}

  debug(message?: any, ...optionalParams: any[]) {
    if (!this.isDev) {
      return;
    }
    this.write(LogLevel.Debug, message, ...optionalParams);
  }

  info(message?: any, ...optionalParams: any[]) {
    this.write(LogLevel.Info, message, ...optionalParams);
  }

  warning(message?: any, ...optionalParams: any[]) {
    this.write(LogLevel.Warning, message, ...optionalParams);
  }

  error(message?: any, ...optionalParams: any[]) {
    this.write(LogLevel.Error, message, ...optionalParams);
  }

  write(level: LogLevel, message?: any, ...optionalParams: any[]) {
    if (this.filter != null && this.filter(level)) {
      return;
    }

    switch (level) {
      case LogLevel.Debug:
        // eslint-disable-next-line
        console.log(message, ...optionalParams);
        break;
      case LogLevel.Info:
        // eslint-disable-next-line
        console.log(message, ...optionalParams);
        break;
      case LogLevel.Warning:
        // eslint-disable-next-line
        console.warn(message, ...optionalParams);
        break;
      case LogLevel.Error:
        // eslint-disable-next-line
        console.error(message, ...optionalParams);
        break;
      default:
        break;
    }
  }
}
