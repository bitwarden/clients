import { LogLevelType } from "../enums/log-level-type.enum";

export abstract class LogService {
  readonly logLevel: LogLevelType;
  abstract debug(message?: any, ...optionalParams: any[]): void;
  abstract info(message?: any, ...optionalParams: any[]): void;
  abstract warning(message?: any, ...optionalParams: any[]): void;
  abstract error(message?: any, ...optionalParams: any[]): void;
  abstract write(level: LogLevelType, message?: any, ...optionalParams: any[]): void;
  abstract updateLogLevel(newLogLevel: LogLevelType): Promise<void>;
}
