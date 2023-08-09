import NotificationQueueMessage from "./notificationQueueMessage";
import { NotificationQueueMessageType } from "./notificationQueueMessageType";

export default class AddUnlockVaultQueueMessage extends NotificationQueueMessage {
  type: NotificationQueueMessageType.UnlockVault;
}
