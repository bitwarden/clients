import { MessageType } from "../generated/push_pb";

export { MessageType };

export interface PushMessage {
  messageType: MessageType;
  message: Record<string, unknown>;
}
