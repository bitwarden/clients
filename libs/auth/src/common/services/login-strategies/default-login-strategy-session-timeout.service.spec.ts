import { MockProxy, mock } from "jest-mock-extended";
import { Subject, firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import { ScheduledTaskNames, TaskSchedulerService } from "@bitwarden/common/platform/scheduling";

import { LoginStrategyCacheService } from "../../abstractions/login-strategy-cache.service";

import {
  LOGIN_SESSION_EXPIRED,
  DefaultLoginStrategySessionTimeoutService,
} from "./default-login-strategy-session-timeout.service";

describe("DefaultLoginStrategySessionTimeoutService", () => {
  let sut: DefaultLoginStrategySessionTimeoutService;

  let taskSchedulerService: MockProxy<TaskSchedulerService>;
  let loginStrategyCacheService: MockProxy<LoginStrategyCacheService>;
  let logService: MockProxy<LogService>;
  let messageSender: MockProxy<MessageSender>;
  let messageListener: MessageListener;
  let messageSubject: Subject<{ command: string } & Record<string, unknown>>;

  beforeEach(() => {
    taskSchedulerService = mock<TaskSchedulerService>();
    loginStrategyCacheService = mock<LoginStrategyCacheService>();
    logService = mock<LogService>();
    messageSender = mock<MessageSender>();
    messageSubject = new Subject();
    messageListener = new MessageListener(messageSubject.asObservable());

    sut = new DefaultLoginStrategySessionTimeoutService(
      taskSchedulerService,
      loginStrategyCacheService,
      logService,
      messageSender,
      messageListener,
    );
  });

  describe("constructor", () => {
    it("should register a task handler with the correct task name", () => {
      expect(taskSchedulerService.registerTaskHandler).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        expect.any(Function),
      );
    });

    it("should send LOGIN_SESSION_EXPIRED and clear cache when handler fires", async () => {
      const handler = taskSchedulerService.registerTaskHandler.mock.calls[0][1];
      await handler();

      expect(messageSender.send).toHaveBeenCalledWith(LOGIN_SESSION_EXPIRED, {});
      expect(loginStrategyCacheService.clearCache).toHaveBeenCalled();
    });

    it("should log error if clearCache throws", async () => {
      const error = new Error("test error");
      loginStrategyCacheService.clearCache.mockRejectedValue(error);

      const handler = taskSchedulerService.registerTaskHandler.mock
        .calls[0][1] as () => Promise<void>;
      await handler();

      expect(logService.error).toHaveBeenCalledWith(
        "Failed to clear cache during session timeout",
        error,
      );
    });

    it("should log error and still clear cache if messageSender.send() throws", async () => {
      const error = new Error("send error");
      messageSender.send.mockImplementation(() => {
        throw error;
      });

      const handler = taskSchedulerService.registerTaskHandler.mock.calls[0][1];
      await handler();

      expect(logService.error).toHaveBeenCalledWith(
        "Failed to send login session expired message",
        error,
      );
      expect(loginStrategyCacheService.clearCache).toHaveBeenCalled();
    });
  });

  describe("loginSessionTimeout$", () => {
    it("should emit when LOGIN_SESSION_EXPIRED message is received", async () => {
      const emitPromise = firstValueFrom(sut.loginSessionTimeout$);

      messageSubject.next({ command: "loginSessionExpired" });

      const result = await emitPromise;
      expect(result).toBeUndefined();
    });
  });

  describe("startSessionTimeout", () => {
    it("should cancel existing timeout first", async () => {
      await sut.startSessionTimeout();

      expect(loginStrategyCacheService.setCacheExpiration).toHaveBeenCalledWith(null);
    });

    it("should set cache expiration with a future date", async () => {
      const frozenNow = 1_000_000;
      jest.useFakeTimers();
      jest.setSystemTime(frozenNow);

      await sut.startSessionTimeout();

      const setCall = loginStrategyCacheService.setCacheExpiration.mock.calls.find(
        (call) => call[0] !== null,
      );
      expect(setCall).toBeDefined();
      const expirationDate = setCall![0] as Date;
      expect(expirationDate.getTime()).toBe(frozenNow + 5 * 60 * 1000);

      jest.useRealTimers();
    });

    it("should call taskSchedulerService.setTimeout", async () => {
      await sut.startSessionTimeout();

      expect(taskSchedulerService.setTimeout).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        5 * 60 * 1000,
      );
    });
  });

  describe("cancelSessionTimeout", () => {
    it("should set cache expiration to null", async () => {
      await sut.cancelSessionTimeout();

      expect(loginStrategyCacheService.setCacheExpiration).toHaveBeenCalledWith(null);
    });

    it("should unsubscribe the existing subscription", async () => {
      const mockSubscription = { unsubscribe: jest.fn() } as any;
      taskSchedulerService.setTimeout.mockReturnValue(mockSubscription);

      await sut.startSessionTimeout();
      await sut.cancelSessionTimeout();

      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });
  });
});
