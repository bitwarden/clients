import { NotificationType } from "../../enums";

import {
  AutoConfirmMemberNotification,
  NotificationResponse,
  SyncCipherUserFieldsNotification,
} from "./notification.response";

describe("NotificationResponse", () => {
  describe("SyncCipherUserFieldsNotification", () => {
    it("parses the per-user fields payload", () => {
      const notification = new NotificationResponse({
        ContextId: "context-123",
        Type: NotificationType.SyncCipherUserFields,
        Payload: JSON.stringify({
          Id: "cipher-id",
          UserId: "user-id",
          FolderId: "folder-id",
          Favorite: true,
          ArchivedDate: "2025-01-02T00:00:00.000Z",
        }),
      });

      expect(notification.payload).toBeInstanceOf(SyncCipherUserFieldsNotification);
      expect(notification.payload).toMatchObject({
        id: "cipher-id",
        userId: "user-id",
        folderId: "folder-id",
        favorite: true,
        archivedDate: "2025-01-02T00:00:00.000Z",
      });
    });

    it("defaults cleared fields to null and false", () => {
      const payload = new SyncCipherUserFieldsNotification({ Id: "cipher-id", UserId: "user-id" });

      expect(payload.folderId).toBeNull();
      expect(payload.favorite).toBe(false);
      expect(payload.archivedDate).toBeNull();
    });
  });

  describe("AutoConfirmMemberNotification", () => {
    it("should parse AutoConfirmMemberNotification payload", () => {
      const response = {
        ContextId: "context-123",
        Type: NotificationType.AutoConfirmMember,
        Payload: {
          TargetUserId: "target-user-id",
          UserId: "user-id",
          OrganizationId: "org-id",
        },
      };

      const notification = new NotificationResponse(response);

      expect(notification.type).toBe(NotificationType.AutoConfirmMember);
      expect(notification.payload).toBeInstanceOf(AutoConfirmMemberNotification);
      expect(notification.payload.targetUserId).toBe("target-user-id");
      expect(notification.payload.userId).toBe("user-id");
      expect(notification.payload.organizationId).toBe("org-id");
    });

    it("should handle stringified JSON payload", () => {
      const response = {
        ContextId: "context-123",
        Type: NotificationType.AutoConfirmMember,
        Payload: JSON.stringify({
          TargetUserId: "target-user-id-2",
          UserId: "user-id-2",
          OrganizationId: "org-id-2",
        }),
      };

      const notification = new NotificationResponse(response);

      expect(notification.type).toBe(NotificationType.AutoConfirmMember);
      expect(notification.payload).toBeInstanceOf(AutoConfirmMemberNotification);
      expect(notification.payload.targetUserId).toBe("target-user-id-2");
      expect(notification.payload.userId).toBe("user-id-2");
      expect(notification.payload.organizationId).toBe("org-id-2");
    });
  });

  describe("AutoConfirmMemberNotification constructor", () => {
    it("should extract all properties from response", () => {
      const response = {
        TargetUserId: "target-user-id",
        UserId: "user-id",
        OrganizationId: "org-id",
      };

      const notification = new AutoConfirmMemberNotification(response);

      expect(notification.targetUserId).toBe("target-user-id");
      expect(notification.userId).toBe("user-id");
      expect(notification.organizationId).toBe("org-id");
    });
  });
});
