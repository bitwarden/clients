import { NotificationType } from "../../enums";

import { AutoConfirmMemberNotification, NotificationResponse } from "./notification.response";

describe("NotificationResponse", () => {
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
