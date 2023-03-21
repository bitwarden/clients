import { EventType } from "../../enums/eventType";
import { Guid } from "../../types/guid";

export class EventRequest {
  type: EventType;
  cipherId: Guid;
  date: string;
  organizationId: Guid;
}
