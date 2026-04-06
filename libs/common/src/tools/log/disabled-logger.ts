import { Jsonify } from "type-fest";

import { deepFreeze } from "../util";

import { SemanticLogger } from "./semantic-logger.abstraction";

/** All disabled loggers emitted by this module are `===` to this logger. */
export const DISABLED_LOGGER: SemanticLogger = deepFreeze({
  debug<T>(_content: Jsonify<T>, _message?: string): void {},

  info<T>(_content: Jsonify<T>, _message?: string): void {},

  warn<T>(_content: Jsonify<T>, _message?: string): void {},

  error<T>(_content: Jsonify<T>, _message?: string): void {},

  panic<T>(content: Jsonify<T>, message?: string): never {
    if (typeof content === "string" && !message) {
      throw new Error(content);
    } else {
      throw new Error(message);
    }
  },
});
