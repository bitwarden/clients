import { MessageType } from "../generated/push";

export { MessageType };

export interface PushMessage {
  messageType: MessageType;
  message: Record<string, unknown>;
}
