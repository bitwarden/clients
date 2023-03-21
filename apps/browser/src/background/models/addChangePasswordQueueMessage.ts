import { Guid } from "@bitwarden/common/types/guid";

import NotificationQueueMessage from "./notificationQueueMessage";
import { NotificationQueueMessageType } from "./notificationQueueMessageType";

export default class AddChangePasswordQueueMessage extends NotificationQueueMessage {
  type: NotificationQueueMessageType.ChangePassword;
  cipherId: Guid;
  newPassword: string;
}
