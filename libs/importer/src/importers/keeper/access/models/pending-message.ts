import { PushMessage } from "./push-message";

export interface PendingMessage {
  resolve: (message: PushMessage) => void;
  reject: (error: Error) => void;
}
