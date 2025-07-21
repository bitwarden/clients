import { map } from "rxjs";

import { CommandDefinition, EXTERNAL_SOURCE_TAG } from "@bitwarden/messaging";

export const getCommand = (
  commandDefinition: CommandDefinition<Record<string, unknown>> | string,
) => {
  if (typeof commandDefinition === "string") {
    return commandDefinition;
  } else {
    return commandDefinition.command;
  }
};

export const tagAsExternal = <T extends Record<PropertyKey, unknown>>() => {
  return map((message: T) => {
    return Object.assign(message, { [EXTERNAL_SOURCE_TAG]: true });
  });
};
