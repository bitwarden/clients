import { Jsonify } from "type-fest";

import { LogService } from "../../platform/abstractions/log.service";
import { LogLevelType } from "../../platform/enums";

import { SemanticLogger } from "./semantic-logger.abstraction";

/** Sends semantic logs to the console.
 *  @remarks the behavior of this logger is based on `LogService`; it
 *   replaces dynamic messages (`%s`) with a JSON-formatted semantic log.
 */
export class DefaultSemanticLogger<Context extends object> implements SemanticLogger {
  /** Instantiates a console semantic logger
   *  @param context a static payload that is cloned when the logger
   *   logs a message. The `messages`, `level`, and `content` fields
   *   are reserved for use by loggers.
   */
  constructor(
    private logger: LogService,
    context: Jsonify<Context>,
  ) {
    this.context = context && typeof context === "object" ? context : {};
  }

  readonly context: object;

  debug<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevelType.Debug, message);
  }

  info<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevelType.Info, message);
  }

  warn<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevelType.Warning, message);
  }

  error<T>(content: Jsonify<T>, message?: string): void {
    this.log(content, LogLevelType.Error, message);
  }

  panic<T>(content: Jsonify<T>, message?: string): never {
    this.log(content, LogLevelType.Error, message);
    const panicMessage =
      message ?? (typeof content === "string" ? content : "a fatal error occurred");
    throw new Error(panicMessage);
  }

  private log<T>(content: Jsonify<T>, level: LogLevelType, message?: string) {
    const log = {
      ...this.context,
      message,
      content: content ?? undefined,
      level: stringifyLevel(level),
    };

    if (typeof content === "string" && !message) {
      log.message = content;
      delete log.content;
    }

    this.logger.write(level, log);
  }
}

function stringifyLevel(level: LogLevelType) {
  switch (level) {
    case LogLevelType.Debug:
      return "debug";
    case LogLevelType.Info:
      return "information";
    case LogLevelType.Warning:
      return "warning";
    case LogLevelType.Error:
      return "error";
    default:
      return `${level}`;
  }
}
