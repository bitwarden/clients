import { EventData } from "../../models/data/event.data";
import { EVENT_COLLECTION_DISK, UserKeyDefinition } from "../../platform/state";

export const EVENT_COLLECTION = UserKeyDefinition.array<EventData>(
  EVENT_COLLECTION_DISK,
  "events",
  {
    deserializer: (s) => EventData.fromJSON(s),
    clearOn: ["logout"],
  },
);
