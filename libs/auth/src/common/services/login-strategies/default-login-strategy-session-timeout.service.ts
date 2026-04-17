import { map, Observable, Subscription } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  CommandDefinition,
  MessageListener,
  MessageSender,
} from "@bitwarden/common/platform/messaging";
import { ScheduledTaskNames, TaskSchedulerService } from "@bitwarden/common/platform/scheduling";

import { LoginStrategyCacheService } from "../../abstractions/login-strategy-cache.service";
import { LoginStrategySessionTimeoutService } from "../../abstractions/login-strategy-session-timeout.service";

const LOGIN_SESSION_TIMEOUT_LENGTH = 5 * 60 * 1000; // 5 minutes

export const LOGIN_SESSION_EXPIRED = new CommandDefinition("loginSessionExpired");

export class DefaultLoginStrategySessionTimeoutService implements LoginStrategySessionTimeoutService {
  private sessionTimeoutSubscription: Subscription | undefined;

  loginSessionTimeout$: Observable<void>;

  constructor(
    private taskSchedulerService: TaskSchedulerService,
    private loginStrategyCacheService: LoginStrategyCacheService,
    private logService: LogService,
    private messageSender: MessageSender,
    private messageListener: MessageListener,
  ) {
    this.loginSessionTimeout$ = this.messageListener
      .messages$(LOGIN_SESSION_EXPIRED)
      .pipe(map((): void => undefined));

    this.taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.loginStrategySessionTimeout,
      async () => {
        try {
          this.messageSender.send(LOGIN_SESSION_EXPIRED, {});
        } catch (e) {
          this.logService.error("Failed to send login session expired message", e);
        }

        try {
          await this.loginStrategyCacheService.clearCache();
        } catch (e) {
          this.logService.error("Failed to clear cache during session timeout", e);
        }
      },
    );
  }

  async startSessionTimeout(): Promise<void> {
    await this.cancelSessionTimeout();

    await this.loginStrategyCacheService.setCacheExpiration(
      new Date(Date.now() + LOGIN_SESSION_TIMEOUT_LENGTH),
    );
    this.sessionTimeoutSubscription = this.taskSchedulerService.setTimeout(
      ScheduledTaskNames.loginStrategySessionTimeout,
      LOGIN_SESSION_TIMEOUT_LENGTH,
    );
  }

  async cancelSessionTimeout(): Promise<void> {
    await this.loginStrategyCacheService.setCacheExpiration(null);
    this.sessionTimeoutSubscription?.unsubscribe();
  }
}
