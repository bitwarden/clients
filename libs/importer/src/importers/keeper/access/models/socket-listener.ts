import { PushMessage } from "./push-message";

export interface SocketListener {
  waitForMessage(): Promise<PushMessage>;
  disconnect(): void;
}
