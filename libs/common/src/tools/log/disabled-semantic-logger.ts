import { Jsonify } from "type-fest";

import { SemanticLogger } from "./semantic-logger.abstraction";

/** Disables semantic logs. Still panics. */
export class DisabledSemanticLogger implements SemanticLogger {
  debug<T>(_content: Jsonify<T>, _message?: string): void {}

  info<T>(_content: Jsonify<T>, _message?: string): void {}

  warn<T>(_content: Jsonify<T>, _message?: string): void {}

  error<T>(_content: Jsonify<T>, _message?: string): void {}

  panic<T>(_content: Jsonify<T>, message?: string): never {
    throw new Error(message);
  }
}
