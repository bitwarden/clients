import { mock, MockProxy } from "jest-mock-extended";
import { Observable } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";
import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";

import { createPortSpyMock } from "../../../autofill/spec/autofill-mocks";
import { flushPromises } from "../../../autofill/spec/testing-utils";
import {
  BrowserTaskSchedulerPortActions,
  BrowserTaskSchedulerPortName,
} from "../abstractions/browser-task-scheduler.service";

import { ForegroundTaskSchedulerService } from "./foreground-task-scheduler.service";

describe("ForegroundTaskSchedulerService", () => {
  let logService: MockProxy<LogService>;
  let stateProvider: MockProxy<StateProvider>;
  let globalStateMock: MockProxy<GlobalState<any>>;
  let portMock: chrome.runtime.Port;
  let foregroundTaskSchedulerService: ForegroundTaskSchedulerService;

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
    foregroundTaskSchedulerService = new ForegroundTaskSchedulerService(logService, stateProvider);
    foregroundTaskSchedulerService["port"] = portMock;
    foregroundTaskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.loginStrategySessionTimeout,
      jest.fn(),
    );
    jest.spyOn(globalThis, "setTimeout");
    jest.spyOn(globalThis, "setInterval");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("sets a timeout for a task and sends a message to the background to set up a backup timeout alarm", async () => {
    foregroundTaskSchedulerService.setTimeout(ScheduledTaskNames.loginStrategySessionTimeout, 1000);
    await flushPromises();

    expect(globalThis.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(chrome.alarms.create).toHaveBeenCalledWith(
      "loginStrategySessionTimeout",
      { delayInMinutes: 0.5 },
      expect.any(Function),
    );
    expect(portMock.postMessage).toHaveBeenCalledWith({
      action: BrowserTaskSchedulerPortActions.setTimeout,
      taskName: ScheduledTaskNames.loginStrategySessionTimeout,
      delayInMs: 1000,
    });
  });

  it("sets an interval for a task and sends a message to the background to set up a backup interval alarm", async () => {
    foregroundTaskSchedulerService.setInterval(
      ScheduledTaskNames.loginStrategySessionTimeout,
      1000,
    );
    await flushPromises();

    expect(globalThis.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(portMock.postMessage).toHaveBeenCalledWith({
      action: BrowserTaskSchedulerPortActions.setInterval,
      taskName: ScheduledTaskNames.loginStrategySessionTimeout,
      intervalInMs: 1000,
    });
  });
});
