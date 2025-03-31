import { TestBed } from "@angular/core/testing";
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

  const mockApiSend = jest.fn();

  let testBed: TestBed;

  beforeEach(async () => {
    mockApiSend.mockClear();

    fakeStateProvider = new FakeStateProvider(mockAccountServiceWith("user-id" as UserId));

    testBed = TestBed.configureTestingModule({
      imports: [],
      providers: [
        DefaultEndUserNotificationService,
        {
          provide: StateProvider,
          useValue: fakeStateProvider,
        },
        {
          provide: ApiService,
          useValue: {
            send: mockApiSend,
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            notifications$: of(null),
          },
        },
      ],
    });
  });

  describe("notifications$", () => {
    it("should return notifications from state when not null", async () => {
      fakeStateProvider.singleUser.mockFor("user-id" as UserId, NOTIFICATIONS, [
        {
          id: "notification-id" as NotificationId,
        } as NotificationViewResponse,
      ]);

      const { notifications$ } = testBed.inject(DefaultEndUserNotificationService);

      const result = await firstValueFrom(notifications$("user-id" as UserId));

      expect(result.length).toBe(1);
      expect(mockApiSend).not.toHaveBeenCalled();
    });

    it("should return notifications API when state is null", async () => {
      mockApiSend.mockResolvedValue({
        data: [
          {
            id: "notification-id",
          },
        ] as NotificationViewResponse[],
      });

      fakeStateProvider.singleUser.mockFor("user-id" as UserId, NOTIFICATIONS, null as any);

      const { notifications$ } = testBed.inject(DefaultEndUserNotificationService);

      const result = await firstValueFrom(notifications$("user-id" as UserId));

      expect(result.length).toBe(1);
      expect(mockApiSend).toHaveBeenCalledWith("GET", "/notifications", null, true, true);
    });

    it("should share the same observable for the same user", async () => {
      const { notifications$ } = testBed.inject(DefaultEndUserNotificationService);

      const first = notifications$("user-id" as UserId);
      const second = notifications$("user-id" as UserId);

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

      const { unreadNotifications$ } = testBed.inject(DefaultEndUserNotificationService);

      const result = await firstValueFrom(unreadNotifications$("user-id" as UserId));

      expect(result.length).toBe(1);
      expect(mockApiSend).not.toHaveBeenCalled();
    });
  });

  describe("getNotifications", () => {
    it("should call getNotifications returning notifications from API", async () => {
      mockApiSend.mockResolvedValue({
        data: [
          {
            id: "notification-id",
          },
        ] as NotificationViewResponse[],
      });
      const service = testBed.inject(DefaultEndUserNotificationService);

      await service.getNotifications("user-id" as UserId);

      expect(mockApiSend).toHaveBeenCalledWith("GET", "/notifications", null, true, true);
    });
  });
  it("should update local state when notifications are updated", async () => {
    mockApiSend.mockResolvedValue({
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

    const service = testBed.inject(DefaultEndUserNotificationService);

    await service.getNotifications("user-id" as UserId);

    expect(mock.nextMock).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "notification-id" as NotificationId,
      } as NotificationViewResponse),
    ]);
  });

  describe("clear", () => {
    it("should clear the local notification state for the user", async () => {
      const mock = fakeStateProvider.singleUser.mockFor("user-id" as UserId, NOTIFICATIONS, [
        {
          id: "notification-id" as NotificationId,
        } as NotificationViewResponse,
      ]);

      const service = testBed.inject(DefaultEndUserNotificationService);

      await service.clearState("user-id" as UserId);

      expect(mock.nextMock).toHaveBeenCalledWith([]);
    });
  });

  describe("markAsDeleted", () => {
    it("should send an API request to mark the notification as deleted", async () => {
      const service = testBed.inject(DefaultEndUserNotificationService);

      await service.markAsDeleted("notification-id" as NotificationId, "user-id" as UserId);
      expect(mockApiSend).toHaveBeenCalledWith(
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
      const service = testBed.inject(DefaultEndUserNotificationService);

      await service.markAsRead("notification-id" as NotificationId, "user-id" as UserId);
      expect(mockApiSend).toHaveBeenCalledWith(
        "PATCH",
        "/notifications/notification-id/read",
        null,
        true,
        false,
      );
    });
  });
});
