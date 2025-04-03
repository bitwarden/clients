import { BehaviorSubject, firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SecurityTaskId, UserId } from "@bitwarden/common/types/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { SecurityTaskStatus } from "../enums";
import { SecurityTaskData, SecurityTaskResponse } from "../models";
import { SECURITY_TASKS } from "../state/security-task.state";

import { DefaultTaskService } from "./default-task.service";

describe("Default task service", () => {
  let fakeStateProvider: FakeStateProvider;

  const mockApiSend = jest.fn();
  const mockGetAllOrgs$ = jest.fn();
  const mockGetFeatureFlag$ = jest.fn();

  let service: DefaultTaskService;

  beforeEach(async () => {
    mockApiSend.mockClear();
    mockGetAllOrgs$.mockClear();
    mockGetFeatureFlag$.mockClear();

    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith("user-id" as UserId));
    service = new DefaultTaskService(
      fakeStateProvider,
      { send: mockApiSend } as unknown as ApiService,
      { organizations$: mockGetAllOrgs$ } as unknown as OrganizationService,
      { getFeatureFlag$: mockGetFeatureFlag$ } as unknown as ConfigService,
    );
  });

  describe("tasksEnabled$", () => {
    it("should emit true if any organization uses risk insights", async () => {
      mockGetFeatureFlag$.mockReturnValue(new BehaviorSubject(true));
      mockGetAllOrgs$.mockReturnValue(
        new BehaviorSubject([
          {
            useRiskInsights: false,
          },
          {
            useRiskInsights: true,
          },
        ] as Organization[]),
      );

      const { tasksEnabled$ } = service;

      const result = await firstValueFrom(tasksEnabled$("user-id" as UserId));

      expect(result).toBe(true);
    });

    it("should emit false if no organization uses risk insights", async () => {
      mockGetFeatureFlag$.mockReturnValue(new BehaviorSubject(true));
      mockGetAllOrgs$.mockReturnValue(
        new BehaviorSubject([
          {
            useRiskInsights: false,
          },
          {
            useRiskInsights: false,
          },
        ] as Organization[]),
      );

      const { tasksEnabled$ } = service;

      const result = await firstValueFrom(tasksEnabled$("user-id" as UserId));

      expect(result).toBe(false);
    });

    it("should emit false if the feature flag is off", async () => {
      mockGetFeatureFlag$.mockReturnValue(new BehaviorSubject(false));
      mockGetAllOrgs$.mockReturnValue(
        new BehaviorSubject([
          {
            useRiskInsights: true,
          },
        ] as Organization[]),
      );

      const { tasksEnabled$ } = service;

      const result = await firstValueFrom(tasksEnabled$("user-id" as UserId));

      expect(result).toBe(false);
    });
  });

  describe("tasks$", () => {
    it("should fetch tasks from the API when the state is null", async () => {
      mockApiSend.mockResolvedValue({
        data: [
          {
            id: "task-id",
          },
        ] as SecurityTaskResponse[],
      });

      fakeStateProvider.singleUser.mockFor("user-id" as UserId, SECURITY_TASKS, null as any);

      const { tasks$ } = service;

      const result = await firstValueFrom(tasks$("user-id" as UserId));

      expect(result.length).toBe(1);
      expect(mockApiSend).toHaveBeenCalledWith("GET", "/tasks", null, true, true);
    });

    it("should use the tasks from state when not null", async () => {
      fakeStateProvider.singleUser.mockFor("user-id" as UserId, SECURITY_TASKS, [
        {
          id: "task-id" as SecurityTaskId,
        } as SecurityTaskData,
      ]);

      const { tasks$ } = service;

      const result = await firstValueFrom(tasks$("user-id" as UserId));

      expect(result.length).toBe(1);
      expect(mockApiSend).not.toHaveBeenCalled();
    });

    it("should share the same observable for the same user", async () => {
      const { tasks$ } = service;

      const first = tasks$("user-id" as UserId);
      const second = tasks$("user-id" as UserId);

      expect(first).toBe(second);
    });
  });

  describe("pendingTasks$", () => {
    it("should filter tasks to only pending tasks", async () => {
      fakeStateProvider.singleUser.mockFor("user-id" as UserId, SECURITY_TASKS, [
        {
          id: "completed-task-id" as SecurityTaskId,
          status: SecurityTaskStatus.Completed,
        },
        {
          id: "pending-task-id" as SecurityTaskId,
          status: SecurityTaskStatus.Pending,
        },
      ] as SecurityTaskData[]);

      const { pendingTasks$ } = service;

      const result = await firstValueFrom(pendingTasks$("user-id" as UserId));

      expect(result.length).toBe(1);
      expect(result[0].id).toBe("pending-task-id" as SecurityTaskId);
    });
  });

  describe("refreshTasks()", () => {
    it("should fetch tasks from the API", async () => {
      mockApiSend.mockResolvedValue({
        data: [
          {
            id: "task-id",
          },
        ] as SecurityTaskResponse[],
      });

      await service.refreshTasks("user-id" as UserId);

      expect(mockApiSend).toHaveBeenCalledWith("GET", "/tasks", null, true, true);
    });

    it("should update the local state with refreshed tasks", async () => {
      mockApiSend.mockResolvedValue({
        data: [
          {
            id: "task-id",
          },
        ] as SecurityTaskResponse[],
      });

      const mock = fakeStateProvider.singleUser.mockFor(
        "user-id" as UserId,
        SECURITY_TASKS,
        null as any,
      );

      await service.refreshTasks("user-id" as UserId);

      expect(mock.nextMock).toHaveBeenCalledWith([
        {
          id: "task-id" as SecurityTaskId,
        } as SecurityTaskData,
      ]);
    });
  });

  describe("clear()", () => {
    it("should clear the local state for the user", async () => {
      const mock = fakeStateProvider.singleUser.mockFor("user-id" as UserId, SECURITY_TASKS, [
        {
          id: "task-id" as SecurityTaskId,
        } as SecurityTaskData,
      ]);

      await service.clear("user-id" as UserId);

      expect(mock.nextMock).toHaveBeenCalledWith([]);
    });
  });

  describe("markAsComplete()", () => {
    it("should send an API request to mark the task as complete", async () => {
      await service.markAsComplete("task-id" as SecurityTaskId, "user-id" as UserId);

      expect(mockApiSend).toHaveBeenCalledWith(
        "PATCH",
        "/tasks/task-id/complete",
        null,
        true,
        false,
      );
    });

    it("should refresh all tasks for the user after marking the task as complete", async () => {
      mockApiSend
        .mockResolvedValueOnce(null) // Mark as complete
        .mockResolvedValueOnce({
          // Refresh tasks
          data: [
            {
              id: "new-task-id",
            },
          ] as SecurityTaskResponse[],
        });

      const mockState = fakeStateProvider.singleUser.mockFor("user-id" as UserId, SECURITY_TASKS, [
        {
          id: "old-task-id" as SecurityTaskId,
        } as SecurityTaskData,
      ]);

      await service.markAsComplete("task-id" as SecurityTaskId, "user-id" as UserId);

      expect(mockApiSend).toHaveBeenCalledWith("GET", "/tasks", null, true, true);
      expect(mockState.nextMock).toHaveBeenCalledWith([
        {
          id: "new-task-id",
        } as SecurityTaskData,
      ]);
    });
  });
});
