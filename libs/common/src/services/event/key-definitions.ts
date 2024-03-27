import { EventData } from "../../models/data/event.data";
import { KeyDefinition, EVENT_COLLECTION_DISK } from "../../platform/state";

export const EVENT_COLLECTION: KeyDefinition<EventData[]> = KeyDefinition.array<EventData>(
  EVENT_COLLECTION_DISK,
  "events",
  {
    deserializer: (s) => EventData.fromJSON(s),
  },
);
