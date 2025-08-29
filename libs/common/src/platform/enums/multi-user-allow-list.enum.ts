import { NotificationType } from "@bitwarden/common/enums";

export const AllowedMultiUserNotificationTypes = new Set<NotificationType>([
  NotificationType.AuthRequest,
]);
