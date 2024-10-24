import { LogLevelType } from "../enums";

import { ConsoleLogService } from "./console-log.service";

export abstract class ConfigurableConsoleLogService extends ConsoleLogService {
  private _storedLogLevel: LogLevelType | null = null;
  private _preInitQueue: Array<Parameters<typeof this.write>> = [];
  private _initNotCalledWarningTimeout: NodeJS.Timeout | null = null;

  private initialized = false;
  override get logLevel(): LogLevelType {
    return this._storedLogLevel ?? this.defaultLogLevel;
  }

  constructor(
    protected isDev: boolean,
    protected defaultLogLevel: LogLevelType = LogLevelType.Warning,
    initWarnInterval: number = 500,
  ) {
    super(isDev, defaultLogLevel);
    this._initNotCalledWarningTimeout = setTimeout(() => {
      if (!this.initialized) {
        super.write(
          LogLevelType.Warning,
          "ConfigurableConsoleLogService has not been initialized. Child Logging classes may not have called init",
        );
      }
    }, initWarnInterval);
  }

  /**
   * Reads the stored log level. This method is not part of the constructor to give implementing classes a chance
   * to set up their storage before calling it.
   *
   * This method MUST be called in the constructor of the implementing class.
   * If it is not, a warning will be logged every 500ms until it is called.
   * @returns {Promise<void>}
   */
  protected async init(): Promise<void> {
    this._initNotCalledWarningTimeout && clearTimeout(this._initNotCalledWarningTimeout);
    return this.readStoredLogLevel().then((level) => {
      this._storedLogLevel = level;
      this.initialized = true;
      this._preInitQueue.forEach(([level, message, ...optionalParams]) => {
        super.write(level, message, ...optionalParams);
      });
      this._preInitQueue = [];
    });
  }

  protected abstract readStoredLogLevel(): Promise<LogLevelType>;
  protected abstract writeStoredLogLevel(level: LogLevelType): Promise<void>;

  async updateLogLevel(level: LogLevelType) {
    this._storedLogLevel = level;
    await this.writeStoredLogLevel(level);
  }

  override write(level: LogLevelType, message?: any, ...optionalParams: any[]) {
    if (this.initialized === false) {
      // If log level is not set, enqueue the message
      this._preInitQueue.push([level, message, ...optionalParams]);
    } else {
      super.write(level, message, ...optionalParams);
    }
  }
}
