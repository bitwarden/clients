import { mock, MockProxy } from "jest-mock-extended";
import { Observable } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";
import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";

import { createPortSpyMock } from "../../../autofill/spec/autofill-mocks";
import {
  flushPromises,
  sendPortMessage,
  triggerPortOnDisconnectEvent,
  triggerRuntimeOnConnectEvent,
} from "../../../autofill/spec/testing-utils";
import {
  BrowserTaskSchedulerPortActions,
  BrowserTaskSchedulerPortName,
} from "../abstractions/browser-task-scheduler.service";

import { BackgroundTaskSchedulerService } from "./background-task-scheduler.service";

describe("BackgroundTaskSchedulerService", () => {
  let logService: MockProxy<LogService>;
  let stateProvider: MockProxy<StateProvider>;
  let globalStateMock: MockProxy<GlobalState<any>>;
  let portMock: chrome.runtime.Port;
  let backgroundTaskSchedulerService: BackgroundTaskSchedulerService;

  beforeEach(() => {
    logService = mock<LogService>();
    globalStateMock = mock<GlobalState<any>>({
      state$: mock<Observable<any>>(),
      update: jest.fn((callback) => callback([], {} as any)),
    });
    stateProvider = mock<StateProvider>({
      getGlobal: jest.fn(() => globalStateMock),
    });
    portMock = createPortSpyMock(BrowserTaskSchedulerPortName);
    backgroundTaskSchedulerService = new BackgroundTaskSchedulerService(logService, stateProvider);
    jest.spyOn(globalThis, "setTimeout");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("ports on connect", () => {
    it("ignores port connections that do not have the correct task scheduler port name", () => {
      const portMockWithDifferentName = createPortSpyMock("different-name");
      triggerRuntimeOnConnectEvent(portMockWithDifferentName);

      expect(portMockWithDifferentName.onMessage.addListener).not.toHaveBeenCalled();
      expect(portMockWithDifferentName.onDisconnect.addListener).not.toHaveBeenCalled();
    });

    it("sets up onMessage and onDisconnect listeners for connected ports", () => {
      triggerRuntimeOnConnectEvent(portMock);

      expect(portMock.onMessage.addListener).toHaveBeenCalled();
      expect(portMock.onDisconnect.addListener).toHaveBeenCalled();
    });
  });

  describe("ports on disconnect", () => {
    it("removes the port from the set of connected ports", () => {
      triggerRuntimeOnConnectEvent(portMock);
      expect(backgroundTaskSchedulerService["ports"].size).toBe(1);

      triggerPortOnDisconnectEvent(portMock);
      expect(backgroundTaskSchedulerService["ports"].size).toBe(0);
      expect(portMock.onMessage.removeListener).toHaveBeenCalled();
      expect(portMock.onDisconnect.removeListener).toHaveBeenCalled();
    });
  });

  describe("port message handlers", () => {
    beforeEach(() => {
      triggerRuntimeOnConnectEvent(portMock);
      backgroundTaskSchedulerService.registerTaskHandler(
        ScheduledTaskNames.loginStrategySessionTimeout,
        jest.fn(),
      );
    });

    it("sets a setTimeout backup alarm", async () => {
      sendPortMessage(portMock, {
        action: BrowserTaskSchedulerPortActions.setTimeout,
        taskName: ScheduledTaskNames.loginStrategySessionTimeout,
        delayInMs: 1000,
      });
      await flushPromises();

      expect(globalThis.setTimeout).toHaveBeenCalled();
      expect(chrome.alarms.create).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { delayInMinutes: 0.5 },
        expect.any(Function),
      );
    });

    it("sets a setInterval backup alarm", async () => {
      sendPortMessage(portMock, {
        action: BrowserTaskSchedulerPortActions.setInterval,
        taskName: ScheduledTaskNames.loginStrategySessionTimeout,
        intervalInMs: 600000,
      });
      await flushPromises();

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        { delayInMinutes: 10, periodInMinutes: 10 },
        expect.any(Function),
      );
    });

    it("clears a scheduled alarm", async () => {
      sendPortMessage(portMock, {
        action: BrowserTaskSchedulerPortActions.clearAlarm,
        alarmName: ScheduledTaskNames.loginStrategySessionTimeout,
      });
      await flushPromises();

      expect(chrome.alarms.clear).toHaveBeenCalledWith(
        ScheduledTaskNames.loginStrategySessionTimeout,
        expect.any(Function),
      );
    });
  });
});
