import { map } from "rxjs";

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

export const EXTERNAL_SOURCE_TAG = Symbol("externalSource");

export const isExternalMessage = (message: Record<PropertyKey, unknown>) => {
  return message?.[EXTERNAL_SOURCE_TAG] === true;
};

export const tagAsExternal = <T extends Record<PropertyKey, unknown>>() => {
  return map((message: T) => {
    return Object.assign(message, { [EXTERNAL_SOURCE_TAG]: true });
  });
};
