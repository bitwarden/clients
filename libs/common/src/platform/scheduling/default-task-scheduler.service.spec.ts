import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "../abstractions/log.service";
import { ScheduledTaskNames } from "../scheduling/scheduled-task-name.enum";

import { DefaultTaskSchedulerService } from "./default-task-scheduler.service";

describe("DefaultTaskSchedulerService", () => {
  const callback = jest.fn();
  const delayInMs = 1000;
  const intervalInMs = 1100;
  let logService: MockProxy<LogService>;
  let taskSchedulerService: DefaultTaskSchedulerService;

  beforeEach(() => {
    jest.useFakeTimers();
    logService = mock<LogService>();
    taskSchedulerService = new DefaultTaskSchedulerService(logService);
    taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.loginStrategySessionTimeout,
      callback,
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  it("triggers an error when setting a timeout for a task that is not registered", async () => {
    expect(() =>
      taskSchedulerService.setTimeout(ScheduledTaskNames.notificationsReconnectTimeout, 1000),
    ).toThrow(
      `Task handler for ${ScheduledTaskNames.notificationsReconnectTimeout} not registered. Unable to schedule task.`,
    );
  });

  it("triggers an error when setting an interval for a task that is not registered", async () => {
    expect(() =>
      taskSchedulerService.setInterval(ScheduledTaskNames.notificationsReconnectTimeout, 1000),
    ).toThrow(
      `Task handler for ${ScheduledTaskNames.notificationsReconnectTimeout} not registered. Unable to schedule task.`,
    );
  });

  it("overrides the handler for a previously registered task and provides a warning about the task registration", () => {
    taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.loginStrategySessionTimeout,
      callback,
    );

    expect(logService.warning).toHaveBeenCalledWith(
      `Task handler for ${ScheduledTaskNames.loginStrategySessionTimeout} already exists. Overwriting.`,
    );
    expect(
      taskSchedulerService["taskHandlers"].get(ScheduledTaskNames.loginStrategySessionTimeout),
    ).toBeDefined();
  });

  it("sets a timeout and returns the timeout id", () => {
    const timeoutId = taskSchedulerService.setTimeout(
      ScheduledTaskNames.loginStrategySessionTimeout,
      delayInMs,
    );

    expect(timeoutId).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(delayInMs);

    expect(callback).toHaveBeenCalled();
  });

  it("sets an interval timeout and results the interval id", () => {
    const intervalId = taskSchedulerService.setInterval(
      ScheduledTaskNames.loginStrategySessionTimeout,
      intervalInMs,
    );

    expect(intervalId).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(intervalInMs);

    expect(callback).toHaveBeenCalled();

    jest.advanceTimersByTime(intervalInMs);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("clears scheduled tasks using the timeout id", () => {
    const timeoutHandle = taskSchedulerService.setTimeout(
      ScheduledTaskNames.loginStrategySessionTimeout,
      delayInMs,
    );

    expect(timeoutHandle).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    timeoutHandle.unsubscribe();

    jest.advanceTimersByTime(delayInMs);

    expect(callback).not.toHaveBeenCalled();
  });

  it("clears scheduled tasks using the interval id", () => {
    const intervalHandle = taskSchedulerService.setInterval(
      ScheduledTaskNames.loginStrategySessionTimeout,
      intervalInMs,
    );

    expect(intervalHandle).toBeDefined();
    expect(callback).not.toHaveBeenCalled();

    intervalHandle.unsubscribe();

    jest.advanceTimersByTime(intervalInMs);

    expect(callback).not.toHaveBeenCalled();
  });
});
