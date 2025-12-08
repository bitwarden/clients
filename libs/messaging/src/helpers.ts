import { map } from "rxjs";

import { EXTERNAL_SOURCE_TAG } from "./is-external-message";
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

export const tagAsExternal = <T extends Record<PropertyKey, unknown>>() => {
  return map((message: T) => {
    return Object.assign(message, { [EXTERNAL_SOURCE_TAG]: true });
  });
};
