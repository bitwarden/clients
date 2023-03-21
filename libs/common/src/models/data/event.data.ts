import { EventType } from "../../enums/eventType";
import { Guid } from "../../types/guid";

export class EventData {
  type: EventType;
  cipherId: Guid;
  date: string;
  organizationId: Guid;
}
