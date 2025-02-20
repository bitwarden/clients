import { Jsonify } from "type-fest";

import { LogService } from "../../platform/abstractions/log.service";

import { DefaultSemanticLogger } from "./default-semantic-logger";
import { DisabledSemanticLogger } from "./disabled-semantic-logger";
import { SemanticLogger } from "./semantic-logger.abstraction";

/** Instantiates a semantic logger that emits nothing when a message
 *  is logged.
 *  @param _context a static payload that is cloned when the logger
 *   logs a message. The `messages`, `level`, and `content` fields
 *   are reserved for use by loggers.
 */
export function disabledSemanticLoggerProvider<Context extends object>(
  _context: Jsonify<Context>,
): SemanticLogger {
  return new DisabledSemanticLogger();
}

/** Instantiates a semantic logger that emits logs to the console.
 *  @param context a static payload that is cloned when the logger
 *   logs a message. The `messages`, `level`, and `content` fields
 *   are reserved for use by loggers.
 *  @param settings specializes how the semantic logger functions.
 *   If this is omitted, the logger suppresses debug messages.
 */
export function consoleSemanticLoggerProvider(logger: LogService): SemanticLogger {
  return new DefaultSemanticLogger(logger, {});
}
