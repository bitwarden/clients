// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EventType } from "../../enums/event-type.enum";

export class EventRequest {
  type: EventType;
  cipherId: string;
  date: string;
  organizationId: string;
}
