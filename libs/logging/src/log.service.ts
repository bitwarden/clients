import { LogLevel } from "./log-level";

export abstract class LogService {
  abstract debug(message?: any, ...optionalParams: any[]): void;
  abstract info(message?: any, ...optionalParams: any[]): void;
  abstract warning(message?: any, ...optionalParams: any[]): void;
  abstract error(message?: any, ...optionalParams: any[]): void;
  abstract write(level: LogLevel, message?: any, ...optionalParams: any[]): void;
}
