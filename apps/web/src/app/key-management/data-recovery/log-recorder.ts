import { LogService } from "@bitwarden/logging";

/**
 * Record logs during the data recovery process. This only keeps them in memory and does not persist them anywhere.
 */
export class LogRecorder {
  private logs: string[] = [];

  constructor(private logService: LogService) {}

  record(message: string) {
    this.logs.push(message);
    this.logService.info(`[DataRecovery] ${message}`);
  }

  getLogs(): string[] {
    return [...this.logs];
  }
}
