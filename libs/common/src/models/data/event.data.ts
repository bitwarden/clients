import { Jsonify } from "type-fest";

import { EventType } from "../../enums";

export class EventData {
  type: EventType;
  cipherId: string;
  date: string;
  organizationId: string;

  static fromJSON(obj: Jsonify<EventData>): EventData {
    return Object.assign(new EventData(), obj);
  }
}
