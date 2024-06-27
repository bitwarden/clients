import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable } from "rxjs";

import { ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";

import { flushPromises, triggerOnAlarmEvent } from "../../../autofill/spec/testing-utils";
import {
  ActiveAlarm,
  BrowserTaskSchedulerService,
} from "../abstractions/browser-task-scheduler.service";

import { BrowserTaskSchedulerServiceImplementation } from "./browser-task-scheduler.service";

jest.mock("rxjs", () => {
  const actualModule = jest.requireActual("rxjs");
  return {
    ...actualModule,
    firstValueFrom: jest.fn((state$: BehaviorSubject<any>) => state$.value),
  };
});

function setupGlobalBrowserMock(overrides: Partial<chrome.alarms.Alarm> = {}) {
  globalThis.browser.alarms = {
    create: jest.fn(),
    clear: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    clearAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    ...overrides,
  };
}

describe("BrowserTaskSchedulerService", () => {
  const callback = jest.fn();
  const delayInMinutes = 2;
  let activeAlarmsMock$: BehaviorSubject<ActiveAlarm[]>;
  let logService: MockProxy<ConsoleLogService>;
  let stateProvider: MockProxy<StateProvider>;
  let globalStateMock: MockProxy<GlobalState<any>>;
  let browserTaskSchedulerService: BrowserTaskSchedulerService;
  let activeAlarms: ActiveAlarm[] = [];
  const eventUploadsIntervalCreateInfo = { periodInMinutes: 5, delayInMinutes: 5 };
  const scheduleNextSyncIntervalCreateInfo = { periodInMinutes: 5, delayInMinutes: 5 };

  beforeEach(() => {
    jest.useFakeTimers();
    activeAlarms = [
      mock<ActiveAlarm>({
        alarmName: ScheduledTaskNames.eventUploadsInterval,
        createInfo: eventUploadsIntervalCreateInfo,
      }),
      mock<ActiveAlarm>({
        alarmName: ScheduledTaskNames.scheduleNextSyncInterval,
        createInfo: scheduleNextSyncIntervalCreateInfo,
      }),
      mock<ActiveAlarm>({
        alarmName: ScheduledTaskNames.fido2ClientAbortTimeout,
        startTime: Date.now() - 60001,
        createInfo: { delayInMinutes: 1, periodInMinutes: undefined },
      }),
    ];
    activeAlarmsMock$ = new BehaviorSubject(activeAlarms);
    logService = mock<ConsoleLogService>();
    globalStateMock = mock<GlobalState<any>>({
      state$: mock<Observable<any>>(),
      update: jest.fn((callback) => callback([], {} as any)),
    });
    stateProvider = mock<StateProvider>({
      getGlobal: jest.fn(() => globalStateMock),
    });
    browserTaskSchedulerService = new BrowserTaskSchedulerServiceImplementation(
      logService,
      stateProvider,
    );
    browserTaskSchedulerService.activeAlarms$ = activeAlarmsMock$;
    browserTaskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.loginStrategySessionTimeout,
      callback,
    );
    // @ts-expect-error mocking global browser object
    // eslint-disable-next-line no-global-assign
    globalThis.browser = {};
    chrome.alarms.get = jest.fn().mockImplementation((_name, callback) => callback(undefined));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();

    // eslint-disable-next-line no-global-assign
    globalThis.browser = undefined;
  });

  describe("setTimeout", () => {
    it("triggers an error when setting a timeout for a task that is not registered", async () => {
      expect(() =>
        browserTaskSchedulerService.setTimeout(
          ScheduledTaskNames.notificationsReconnectTimeout,
          1000,
        ),
      ).toThrow(
        `Task handler for ${ScheduledTaskNames.notificationsReconnectTimeout} not registered. Unable to schedule task.`,
      );
    });

    it("creates a timeout alarm", async () => {
      browserTaskSchedulerService.setTimeout(
        ScheduledTaskNames.loginStrategySessionTimeout,
        delayInMinutes * 60 * 1000,
      );
      await flushPromises();

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { delayInMinutes },
        expect.any(Function),
      );
    });

    it("skips creating a duplicate timeout alarm", async () => {
      const mockAlarm = mock<chrome.alarms.Alarm>();
      chrome.alarms.get = jest.fn().mockImplementation((_name, callback) => callback(mockAlarm));

      browserTaskSchedulerService.setTimeout(
        ScheduledTaskNames.loginStrategySessionTimeout,
        delayInMinutes * 60 * 1000,
      );

      expect(chrome.alarms.create).not.toHaveBeenCalled();
    });

    describe("when the task is scheduled to be triggered in less than the minimum possible delay", () => {
      const delayInMs = 25000;

      it("sets a timeout using the global setTimeout API", async () => {
        jest.spyOn(globalThis, "setTimeout");

        browserTaskSchedulerService.setTimeout(
          ScheduledTaskNames.loginStrategySessionTimeout,
          delayInMs,
        );
        await flushPromises();

        expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), delayInMs);
      });

      it("sets a fallback alarm", async () => {
        const delayInMs = 15000;
        browserTaskSchedulerService.setTimeout(
          ScheduledTaskNames.loginStrategySessionTimeout,
          delayInMs,
        );
        await flushPromises();

        expect(chrome.alarms.create).toHaveBeenCalledWith(
          ScheduledTaskNames.loginStrategySessionTimeout,
          { delayInMinutes: 0.5 },
          expect.any(Function),
        );
      });

      it("sets the fallback for a minimum of 1 minute if the environment not for Chrome", async () => {
        setupGlobalBrowserMock();

        browserTaskSchedulerService.setTimeout(
          ScheduledTaskNames.loginStrategySessionTimeout,
          delayInMs,
        );
        await flushPromises();

        expect(browser.alarms.create).toHaveBeenCalledWith(
          ScheduledTaskNames.loginStrategySessionTimeout,
          { delayInMinutes: 1 },
        );
      });

      it("clears the fallback alarm when the setTimeout is triggered", async () => {
        jest.useFakeTimers();

        browserTaskSchedulerService.setTimeout(
          ScheduledTaskNames.loginStrategySessionTimeout,
          delayInMs,
        );
        jest.advanceTimersByTime(delayInMs);
        await flushPromises();

        expect(chrome.alarms.clear).toHaveBeenCalledWith(
          ScheduledTaskNames.loginStrategySessionTimeout,
          expect.any(Function),
        );
      });
    });

    it("returns a subscription that can be used to clear the timeout", () => {
      jest.spyOn(globalThis, "clearTimeout");

      const timeoutSubscription = browserTaskSchedulerService.setTimeout(
        ScheduledTaskNames.loginStrategySessionTimeout,
        10000,
      );

      timeoutSubscription.unsubscribe();

      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        expect.any(Function),
      );
      expect(globalThis.clearTimeout).toHaveBeenCalled();
    });

    it("clears alarms in non-chrome environments", () => {
      setupGlobalBrowserMock();

      const timeoutSubscription = browserTaskSchedulerService.setTimeout(
        ScheduledTaskNames.loginStrategySessionTimeout,
        10000,
      );
      timeoutSubscription.unsubscribe();

      expect(browser.alarms.clear).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
      );
    });
  });

  describe("setInterval", () => {
    it("triggers an error when setting an interval for a task that is not registered", async () => {
      expect(() => {
        browserTaskSchedulerService.setInterval(
          ScheduledTaskNames.notificationsReconnectTimeout,
          1000,
        );
      }).toThrow(
        `Task handler for ${ScheduledTaskNames.notificationsReconnectTimeout} not registered. Unable to schedule task.`,
      );
    });

    describe("setting an interval that is less than 1 minute", () => {
      const intervalInMs = 10000;

      it("sets up stepped alarms that trigger behavior after the first minute of setInterval execution", async () => {
        browserTaskSchedulerService.setInterval(
          ScheduledTaskNames.loginStrategySessionTimeout,
          intervalInMs,
        );
        await flushPromises();

        expect(chrome.alarms.create).toHaveBeenCalledWith(
          `${ScheduledTaskNames.loginStrategySessionTimeout}__0`,
          { periodInMinutes: 0.6666666666666666, delayInMinutes: 0.5 },
          expect.any(Function),
        );
        expect(chrome.alarms.create).toHaveBeenCalledWith(
          `${ScheduledTaskNames.loginStrategySessionTimeout}__1`,
          { periodInMinutes: 0.6666666666666666, delayInMinutes: 0.6666666666666666 },
          expect.any(Function),
        );
        expect(chrome.alarms.create).toHaveBeenCalledWith(
          `${ScheduledTaskNames.loginStrategySessionTimeout}__2`,
          { periodInMinutes: 0.6666666666666666, delayInMinutes: 0.8333333333333333 },
          expect.any(Function),
        );
        expect(chrome.alarms.create).toHaveBeenCalledWith(
          `${ScheduledTaskNames.loginStrategySessionTimeout}__3`,
          { periodInMinutes: 0.6666666666666666, delayInMinutes: 1 },
          expect.any(Function),
        );
      });

      it("sets an interval using the global setInterval API", async () => {
        jest.spyOn(globalThis, "setInterval");

        browserTaskSchedulerService.setInterval(
          ScheduledTaskNames.loginStrategySessionTimeout,
          intervalInMs,
        );
        await flushPromises();

        expect(globalThis.setInterval).toHaveBeenCalledWith(expect.any(Function), intervalInMs);
      });

      it("clears the global setInterval instance once the interval has elapsed the minimum required delay for an alarm", async () => {
        jest.useFakeTimers();
        jest.spyOn(globalThis, "clearInterval");

        browserTaskSchedulerService.setInterval(
          ScheduledTaskNames.loginStrategySessionTimeout,
          intervalInMs,
        );
        await flushPromises();
        jest.advanceTimersByTime(50000);

        expect(globalThis.clearInterval).toHaveBeenCalledWith(expect.any(Number));
      });
    });

    it("creates an interval alarm", async () => {
      const periodInMinutes = 2;
      const initialDelayInMs = 1000;

      browserTaskSchedulerService.setInterval(
        ScheduledTaskNames.loginStrategySessionTimeout,
        periodInMinutes * 60 * 1000,
        initialDelayInMs,
      );
      await flushPromises();

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { periodInMinutes, delayInMinutes: 0.5 },
        expect.any(Function),
      );
    });

    it("defaults the alarm's delay in minutes to the interval in minutes if the delay is not specified", async () => {
      const periodInMinutes = 2;
      browserTaskSchedulerService.setInterval(
        ScheduledTaskNames.loginStrategySessionTimeout,
        periodInMinutes * 60 * 1000,
      );
      await flushPromises();

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { periodInMinutes, delayInMinutes: periodInMinutes },
        expect.any(Function),
      );
    });

    it("returns a subscription that can be used to clear an interval alarm", () => {
      jest.spyOn(globalThis, "clearInterval");

      const intervalSubscription = browserTaskSchedulerService.setInterval(
        ScheduledTaskNames.loginStrategySessionTimeout,
        600000,
      );

      intervalSubscription.unsubscribe();

      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        expect.any(Function),
      );
      expect(globalThis.clearInterval).not.toHaveBeenCalled();
    });

    it("returns a subscription that can be used to clear all stepped interval alarms", () => {
      jest.spyOn(globalThis, "clearInterval");

      const intervalSubscription = browserTaskSchedulerService.setInterval(
        ScheduledTaskNames.loginStrategySessionTimeout,
        10000,
      );

      intervalSubscription.unsubscribe();

      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        `${ScheduledTaskNames.loginStrategySessionTimeout}__0`,
        expect.any(Function),
      );
      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        `${ScheduledTaskNames.loginStrategySessionTimeout}__1`,
        expect.any(Function),
      );
      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        `${ScheduledTaskNames.loginStrategySessionTimeout}__2`,
        expect.any(Function),
      );
      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        `${ScheduledTaskNames.loginStrategySessionTimeout}__3`,
        expect.any(Function),
      );
      expect(globalThis.clearInterval).toHaveBeenCalled();
    });
  });

  describe("verifyAlarmsState", () => {
    it("skips recovering a scheduled task if an existing alarm for the task is present", async () => {
      chrome.alarms.get = jest
        .fn()
        .mockImplementation((_name, callback) => callback(mock<chrome.alarms.Alarm>()));

      await browserTaskSchedulerService.verifyAlarmsState();

      expect(chrome.alarms.create).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });

    describe("extension alarm is not set", () => {
      it("triggers the task when the task should have triggered", async () => {
        const fido2Callback = jest.fn();
        browserTaskSchedulerService.registerTaskHandler(
          ScheduledTaskNames.fido2ClientAbortTimeout,
          fido2Callback,
        );

        await browserTaskSchedulerService.verifyAlarmsState();

        expect(fido2Callback).toHaveBeenCalled();
      });

      it("schedules an alarm for the task when it has not yet triggered ", async () => {
        const syncCallback = jest.fn();
        browserTaskSchedulerService.registerTaskHandler(
          ScheduledTaskNames.scheduleNextSyncInterval,
          syncCallback,
        );

        await browserTaskSchedulerService.verifyAlarmsState();

        expect(chrome.alarms.create).toHaveBeenCalledWith(
          ScheduledTaskNames.scheduleNextSyncInterval,
          scheduleNextSyncIntervalCreateInfo,
          expect.any(Function),
        );
      });
    });
  });

  describe("triggering a task", () => {
    it("triggers a task when an onAlarm event is triggered", () => {
      const alarm = mock<chrome.alarms.Alarm>({
        name: ScheduledTaskNames.loginStrategySessionTimeout,
      });

      triggerOnAlarmEvent(alarm);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("clearAllScheduledTasks", () => {
    it("clears all scheduled tasks and extension alarms", async () => {
      // @ts-expect-error mocking global state update method
      globalStateMock.update = jest.fn((callback) => {
        const stateValue = callback([], {} as any);
        activeAlarmsMock$.next(stateValue);
        return stateValue;
      });

      await browserTaskSchedulerService.clearAllScheduledTasks();

      expect(chrome.alarms.clearAll).toHaveBeenCalled();
      expect(activeAlarmsMock$.value).toEqual([]);
    });

    it("clears all extension alarms within a non Chrome environment", async () => {
      setupGlobalBrowserMock();

      await browserTaskSchedulerService.clearAllScheduledTasks();

      expect(browser.alarms.clearAll).toHaveBeenCalled();
    });
  });
});
