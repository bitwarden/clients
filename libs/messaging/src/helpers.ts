import { map } from "rxjs";

import { stampAsExternal } from "./is-external-message";
import { CommandDefinition } from "./types";

export const getCommand = (
  commandDefinition: CommandDefinition<Record<string, unknown>> | string,
) => {
  if (typeof commandDefinition === "string") {
    return commandDefinition;
  } else {
    return commandDefinition.command;
  }
};

/**
 * An operator that stamps every message in a stream as having arrived from an external source,
 * in place. Call this where messages enter the process, ahead of `share()`, so every subscriber
 * observes the same stamped object.
 *
 * Only for streams fed from another context. Intra-process streams must stay unstamped, or
 * {@link isExternalMessage} loses its meaning.
 *
 * Messages must be non-frozen objects. A primitive or nullish message throws, which errors the
 * stream for every subscriber, so guard the source as `fromChromeRuntimeMessaging` does.
 */
export const tagAsExternal = <T extends Record<PropertyKey, unknown>>() => {
  return map((message: T) => stampAsExternal(message));
};
