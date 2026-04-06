import { mock, MockProxy } from "jest-mock-extended";

import { TaskSchedulerService, ScheduledTaskNames } from "@bitwarden/common/platform/scheduling";

import { BackgroundSyncService, DEFAULT_SYNC_INTERVAL_MS } from "./background-sync.service";

describe("BackgroundSyncService", () => {
  let taskSchedulerService: MockProxy<TaskSchedulerService>;
  let backgroundSyncService: BackgroundSyncService;

  beforeEach(() => {
    taskSchedulerService = mock<TaskSchedulerService>();
    backgroundSyncService = new BackgroundSyncService(taskSchedulerService);
  });

  describe("register", () => {
    it("registers a task handler with the correct task name", () => {
      // Arrange
      const syncCallback = jest.fn().mockResolvedValue(undefined);

      // Act
      backgroundSyncService.register(syncCallback);

      // Assert
      expect(taskSchedulerService.registerTaskHandler).toHaveBeenCalledTimes(1);
      expect(taskSchedulerService.registerTaskHandler).toHaveBeenCalledWith(
        ScheduledTaskNames.scheduleNextSyncInterval,
        syncCallback,
      );
    });
  });

  describe("init", () => {
    it("schedules the sync interval task with default interval", () => {
      // Act
      backgroundSyncService.init();

      // Assert
      expect(taskSchedulerService.setInterval).toHaveBeenCalledTimes(1);
      expect(taskSchedulerService.setInterval).toHaveBeenCalledWith(
        ScheduledTaskNames.scheduleNextSyncInterval,
        DEFAULT_SYNC_INTERVAL_MS,
      );
    });

    it("schedules the sync interval task with custom interval", () => {
      // Arrange
      const customInterval = 60000; // 1 minute

      // Act
      backgroundSyncService.init(customInterval);

      // Assert
      expect(taskSchedulerService.setInterval).toHaveBeenCalledTimes(1);
      expect(taskSchedulerService.setInterval).toHaveBeenCalledWith(
        ScheduledTaskNames.scheduleNextSyncInterval,
        customInterval,
      );
    });

    it("correctly handles zero interval by using default", () => {
      // Act
      backgroundSyncService.init(0);

      // Assert
      expect(taskSchedulerService.setInterval).toHaveBeenCalledTimes(1);
      expect(taskSchedulerService.setInterval).toHaveBeenCalledWith(
        ScheduledTaskNames.scheduleNextSyncInterval,
        DEFAULT_SYNC_INTERVAL_MS,
      );
    });

    it("correctly handles negative interval by using default", () => {
      // Act
      backgroundSyncService.init(-1000);

      // Assert
      expect(taskSchedulerService.setInterval).toHaveBeenCalledTimes(1);
      expect(taskSchedulerService.setInterval).toHaveBeenCalledWith(
        ScheduledTaskNames.scheduleNextSyncInterval,
        DEFAULT_SYNC_INTERVAL_MS,
      );
    });
  });

  describe("full integration", () => {
    it("registers and initializes correctly in sequence", () => {
      // Arrange
      const syncCallback = jest.fn().mockResolvedValue(undefined);
      const customInterval = 45000; // 45 seconds

      // Act
      backgroundSyncService.register(syncCallback);
      backgroundSyncService.init(customInterval);

      // Assert
      expect(taskSchedulerService.registerTaskHandler).toHaveBeenCalledWith(
        ScheduledTaskNames.scheduleNextSyncInterval,
        syncCallback,
      );
      expect(taskSchedulerService.setInterval).toHaveBeenCalledWith(
        ScheduledTaskNames.scheduleNextSyncInterval,
        customInterval,
      );
    });
  });
});
