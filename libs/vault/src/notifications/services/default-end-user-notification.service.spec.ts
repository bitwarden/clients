import { firstValueFrom, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { NotificationsService } from "@bitwarden/common/platform/notifications";
import { StateProvider } from "@bitwarden/common/platform/state";
import { NotificationId, UserId } from "@bitwarden/common/types/guid";
import { DefaultEndUserNotificationService } from "@bitwarden/vault";

import { FakeStateProvider, mockAccountServiceWith } from "../../../../common/spec";
import { NotificationViewResponse } from "../models";
import { NOTIFICATIONS } from "../state/end-user-notification.state";

describe("End User Notification Center Service", () => {
  let fakeStateProvider: FakeStateProvider;
  let mockApiService: jest.Mocked<ApiService>;
  let mockNotificationsService: jest.Mocked<NotificationsService>;
  let service: DefaultEndUserNotificationService;

  beforeEach(() => {
    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith("user-id" as UserId));
    mockApiService = {
      send: jest.fn(),
    } as any;
    mockNotificationsService = {
      notifications$: of(null),
    } as any;

    service = new DefaultEndUserNotificationService(
      fakeStateProvider as unknown as StateProvider,
      mockApiService,
      mockNotificationsService,
    );
  });

  describe("notifications$", () => {
    it("should return notifications from state when not null", async () => {
      fakeStateProvider.singleUser.mockFor("user-id" as UserId, NOTIFICATIONS, [
        {
          id: "notification-id" as NotificationId,
        } as NotificationViewResponse,
      ]);

      const result = await firstValueFrom(service.notifications$("user-id" as UserId));

      expect(result.length).toBe(1);
      expect(mockApiService.send).not.toHaveBeenCalled();
    });

    it("should return notifications API when state is null", async () => {
      mockApiService.send.mockResolvedValue({
        data: [
          {
            id: "notification-id",
          },
        ] as NotificationViewResponse[],
      });

      fakeStateProvider.singleUser.mockFor("user-id" as UserId, NOTIFICATIONS, null as any);

      const result = await firstValueFrom(service.notifications$("user-id" as UserId));

      expect(result.length).toBe(1);
      expect(mockApiService.send).toHaveBeenCalledWith("GET", "/notifications", null, true, true);
    });

    it("should share the same observable for the same user", async () => {
      const first = service.notifications$("user-id" as UserId);
      const second = service.notifications$("user-id" as UserId);

      expect(first).toBe(second);
    });
  });

  describe("unreadNotifications$", () => {
    it("should return unread notifications from state when read value is null", async () => {
      fakeStateProvider.singleUser.mockFor("user-id" as UserId, NOTIFICATIONS, [
        {
          id: "notification-id" as NotificationId,
          readDate: null as any,
        } as NotificationViewResponse,
      ]);

      const result = await firstValueFrom(service.unreadNotifications$("user-id" as UserId));

      expect(result.length).toBe(1);
      expect(mockApiService.send).not.toHaveBeenCalled();
    });
  });

  describe("getNotifications", () => {
    it("should call getNotifications returning notifications from API", async () => {
      mockApiService.send.mockResolvedValue({
        data: [
          {
            id: "notification-id",
          },
        ] as NotificationViewResponse[],
      });

      await service.getNotifications("user-id" as UserId);

      expect(mockApiService.send).toHaveBeenCalledWith("GET", "/notifications", null, true, true);
    });

    it("should update local state when notifications are updated", async () => {
      mockApiService.send.mockResolvedValue({
        data: [
          {
            id: "notification-id",
          },
        ] as NotificationViewResponse[],
      });

      const mock = fakeStateProvider.singleUser.mockFor(
        "user-id" as UserId,
        NOTIFICATIONS,
        null as any,
      );

      await service.getNotifications("user-id" as UserId);

      expect(mock.nextMock).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "notification-id" as NotificationId,
        } as NotificationViewResponse),
      ]);
    });
  });

  describe("clear", () => {
    it("should clear the local notification state for the user", async () => {
      const mock = fakeStateProvider.singleUser.mockFor("user-id" as UserId, NOTIFICATIONS, [
        {
          id: "notification-id" as NotificationId,
        } as NotificationViewResponse,
      ]);

      await service.clearState("user-id" as UserId);

      expect(mock.nextMock).toHaveBeenCalledWith([]);
    });
  });

  describe("markAsDeleted", () => {
    it("should send an API request to mark the notification as deleted", async () => {
      await service.markAsDeleted("notification-id" as NotificationId, "user-id" as UserId);
      expect(mockApiService.send).toHaveBeenCalledWith(
        "DELETE",
        "/notifications/notification-id/delete",
        null,
        true,
        false,
      );
    });
  });

  describe("markAsRead", () => {
    it("should send an API request to mark the notification as read", async () => {
      await service.markAsRead("notification-id" as NotificationId, "user-id" as UserId);
      expect(mockApiService.send).toHaveBeenCalledWith(
        "PATCH",
        "/notifications/notification-id/read",
        null,
        true,
        false,
      );
    });
  });
});
