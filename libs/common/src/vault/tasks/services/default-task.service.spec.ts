import { BehaviorSubject, firstValueFrom, Subject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { NotificationType } from "@bitwarden/common/enums";
import { NotificationResponse } from "@bitwarden/common/models/response/notification.response";
import { Message, MessageListener } from "@bitwarden/common/platform/messaging";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { SecurityTaskId, UserId } from "@bitwarden/common/types/guid";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { SecurityTaskStatus } from "../enums";
import { SecurityTaskData, SecurityTaskResponse } from "../models";
import { SECURITY_TASKS } from "../state/security-task.state";

import { DefaultTaskService } from "./default-task.service";

describe("Default task service", () => {
  let fakeStateProvider: FakeStateProvider;

  const userId = "user-id" as UserId;
  const mockApiSend = jest.fn();
  const mockGetAllOrgs$ = jest.fn();
  const mockAuthStatuses$ = new BehaviorSubject<Record<UserId, AuthenticationStatus>>({});
  const mockNotifications$ = new Subject<readonly [NotificationResponse, UserId]>();
  const mockMessages$ = new Subject<Message<Record<string, unknown>>>();
  let service: DefaultTaskService;

  beforeEach(async () => {
    mockApiSend.mockClear();
    mockGetAllOrgs$.mockClear();

    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    service = new DefaultTaskService(
      fakeStateProvider,
      { send: mockApiSend } as unknown as ApiService,
      { organizations$: mockGetAllOrgs$ } as unknown as OrganizationService,
      { authStatuses$: mockAuthStatuses$.asObservable() } as unknown as AuthService,
      {
        notifications$: mockNotifications$.asObservable(),
      } as unknown as ServerNotificationsService,
      { allMessages$: mockMessages$.asObservable() } as unknown as MessageListener,
    );
  });

  describe("tasksEnabled$", () => {
    it("should emit true if any organization uses risk insights", async () => {
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
  });

  describe("tasks$", () => {
    beforeEach(() => {
      mockGetAllOrgs$.mockReturnValue(
        new BehaviorSubject([
          {
            useRiskInsights: true,
          },
        ] as Organization[]),
      );
    });

    it("should return an empty array if tasks are not enabled", async () => {
      mockGetAllOrgs$.mockReturnValue(
        new BehaviorSubject([
          {
            useRiskInsights: false,
          },
        ] as Organization[]),
      );

      const { tasks$ } = service;

      const result = await firstValueFrom(tasks$("user-id" as UserId));

      expect(result.length).toBe(0);
      expect(mockApiSend).not.toHaveBeenCalled();
    });

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
    beforeEach(() => {
      mockGetAllOrgs$.mockReturnValue(
        new BehaviorSubject([
          {
            useRiskInsights: true,
          },
        ] as Organization[]),
      );
    });

    it("should return an empty array if tasks are not enabled", async () => {
      mockGetAllOrgs$.mockReturnValue(
        new BehaviorSubject([
          {
            useRiskInsights: false,
          },
        ] as Organization[]),
      );

      const { pendingTasks$ } = service;

      const result = await firstValueFrom(pendingTasks$("user-id" as UserId));

      expect(result.length).toBe(0);
      expect(mockApiSend).not.toHaveBeenCalled();
    });

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

  describe("listenForTaskNotifications()", () => {
    it("should not subscribe to notifications when there are no unlocked users", () => {
      mockAuthStatuses$.next({
        [userId]: AuthenticationStatus.Locked,
      });

      service.tasksEnabled$ = jest.fn(() => new BehaviorSubject(true));
      const notificationHelper$ = (service["securityTaskNotifications$"] = jest.fn());
      const syncCompletedHelper$ = (service["syncCompletedMessage$"] = jest.fn());

      const subscription = service.listenForTaskNotifications();

      expect(notificationHelper$).not.toHaveBeenCalled();
      expect(syncCompletedHelper$).not.toHaveBeenCalled();
      subscription.unsubscribe();
    });

    it("should not subscribe to notifications when no users have tasks enabled", () => {
      mockAuthStatuses$.next({
        [userId]: AuthenticationStatus.Unlocked,
      });

      service.tasksEnabled$ = jest.fn(() => new BehaviorSubject(false));
      const notificationHelper$ = (service["securityTaskNotifications$"] = jest.fn());
      const syncCompletedHelper$ = (service["syncCompletedMessage$"] = jest.fn());

      const subscription = service.listenForTaskNotifications();

      expect(notificationHelper$).not.toHaveBeenCalled();
      expect(syncCompletedHelper$).not.toHaveBeenCalled();
      subscription.unsubscribe();
    });

    it("should subscribe to notifications when there are unlocked users with tasks enabled", () => {
      mockAuthStatuses$.next({
        [userId]: AuthenticationStatus.Unlocked,
      });
      service.tasksEnabled$ = jest.fn(() => new BehaviorSubject(true));

      const notificationHelper$ = (service["securityTaskNotifications$"] = jest.fn());
      const syncCompletedHelper$ = (service["syncCompletedMessage$"] = jest.fn());

      const subscription = service.listenForTaskNotifications();

      expect(notificationHelper$).toHaveBeenCalled();
      expect(syncCompletedHelper$).toHaveBeenCalled();
      subscription.unsubscribe();
    });

    describe("notification handling", () => {
      it("should refresh tasks when a notification is received for an allowed user", async () => {
        mockAuthStatuses$.next({
          [userId]: AuthenticationStatus.Unlocked,
        });
        service.tasksEnabled$ = jest.fn(() => new BehaviorSubject(true));

        const syncCompletedHelper$ = (service["syncCompletedMessage$"] = jest.fn(
          () => new Subject(),
        ));
        const refreshTasks = jest.spyOn(service, "refreshTasks");

        const subscription = service.listenForTaskNotifications();

        const notification = {
          type: NotificationType.RefreshSecurityTasks,
        } as NotificationResponse;
        mockNotifications$.next([notification, userId]);

        await new Promise(process.nextTick);

        expect(syncCompletedHelper$).toHaveBeenCalled();
        expect(refreshTasks).toHaveBeenCalledWith(userId);
        subscription.unsubscribe();
      });

      it("should ignore notifications for other users", async () => {
        mockAuthStatuses$.next({
          [userId]: AuthenticationStatus.Unlocked,
        });
        service.tasksEnabled$ = jest.fn(() => new BehaviorSubject(true));

        const syncCompletedHelper$ = (service["syncCompletedMessage$"] = jest.fn(
          () => new Subject(),
        ));
        const refreshTasks = jest.spyOn(service, "refreshTasks");

        const subscription = service.listenForTaskNotifications();

        const notification = {
          type: NotificationType.RefreshSecurityTasks,
        } as NotificationResponse;
        mockNotifications$.next([notification, "other-user-id" as UserId]);

        await new Promise(process.nextTick);

        expect(syncCompletedHelper$).toHaveBeenCalled();
        expect(refreshTasks).not.toHaveBeenCalledWith(userId);
        subscription.unsubscribe();
      });

      it("should ignore other notifications types", async () => {
        mockAuthStatuses$.next({
          [userId]: AuthenticationStatus.Unlocked,
        });
        service.tasksEnabled$ = jest.fn(() => new BehaviorSubject(true));

        const syncCompletedHelper$ = (service["syncCompletedMessage$"] = jest.fn(
          () => new Subject(),
        ));
        const refreshTasks = jest.spyOn(service, "refreshTasks");

        const subscription = service.listenForTaskNotifications();

        const notification = {
          type: NotificationType.SyncSettings,
        } as NotificationResponse;
        mockNotifications$.next([notification, userId]);

        await new Promise(process.nextTick);

        expect(syncCompletedHelper$).toHaveBeenCalled();
        expect(refreshTasks).not.toHaveBeenCalledWith(userId);
        subscription.unsubscribe();
      });
    });

    describe("sync completed handling", () => {
      it("should refresh tasks when a sync completed message is received for an allowed user", async () => {
        mockAuthStatuses$.next({
          [userId]: AuthenticationStatus.Unlocked,
        });
        service.tasksEnabled$ = jest.fn(() => new BehaviorSubject(true));

        const notificationHelper$ = (service["securityTaskNotifications$"] = jest.fn(
          () => new Subject(),
        ));
        const refreshTasks = jest.spyOn(service, "refreshTasks");

        const subscription = service.listenForTaskNotifications();

        mockMessages$.next({
          command: "syncCompleted",
          userId,
          successfully: true,
        });

        await new Promise(process.nextTick);

        expect(notificationHelper$).toHaveBeenCalled();
        expect(refreshTasks).toHaveBeenCalledWith(userId);
        subscription.unsubscribe();
      });

      it("should ignore non syncCompleted messages", async () => {
        mockAuthStatuses$.next({
          [userId]: AuthenticationStatus.Unlocked,
        });
        service.tasksEnabled$ = jest.fn(() => new BehaviorSubject(true));

        const notificationHelper$ = (service["securityTaskNotifications$"] = jest.fn(
          () => new Subject(),
        ));
        const refreshTasks = jest.spyOn(service, "refreshTasks");

        const subscription = service.listenForTaskNotifications();

        mockMessages$.next({
          command: "other-command",
        });

        await new Promise(process.nextTick);

        expect(notificationHelper$).toHaveBeenCalled();
        expect(refreshTasks).not.toHaveBeenCalledWith(userId);
        subscription.unsubscribe();
      });

      it("should ignore failed sync messages", async () => {
        mockAuthStatuses$.next({
          [userId]: AuthenticationStatus.Unlocked,
        });
        service.tasksEnabled$ = jest.fn(() => new BehaviorSubject(true));

        const notificationHelper$ = (service["securityTaskNotifications$"] = jest.fn(
          () => new Subject(),
        ));
        const refreshTasks = jest.spyOn(service, "refreshTasks");

        const subscription = service.listenForTaskNotifications();

        mockMessages$.next({
          command: "syncCompleted",
          userId,
          successfully: false,
        });

        await new Promise(process.nextTick);

        expect(notificationHelper$).toHaveBeenCalled();
        expect(refreshTasks).not.toHaveBeenCalledWith(userId);
        subscription.unsubscribe();
      });

      it("should ignore sync messages for other users", async () => {
        mockAuthStatuses$.next({
          [userId]: AuthenticationStatus.Unlocked,
        });
        service.tasksEnabled$ = jest.fn(() => new BehaviorSubject(true));

        const notificationHelper$ = (service["securityTaskNotifications$"] = jest.fn(
          () => new Subject(),
        ));
        const refreshTasks = jest.spyOn(service, "refreshTasks");

        const subscription = service.listenForTaskNotifications();

        mockMessages$.next({
          command: "syncCompleted",
          userId: "other-user-id" as UserId,
          successfully: true,
        });

        await new Promise(process.nextTick);

        expect(notificationHelper$).toHaveBeenCalled();
        expect(refreshTasks).not.toHaveBeenCalledWith(userId);
        subscription.unsubscribe();
      });
    });
  });
});
