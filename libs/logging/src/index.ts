import { Jsonify } from "type-fest";

import { SemanticLogger } from "./semantic-logger.abstraction";

export { LogService } from "./log.service";
export { LogLevel } from "./log-level";
export { ConsoleLogService } from "./console-log.service";
export { SemanticLogger } from "./semantic-logger.abstraction";
export { DISABLED_LOGGER } from "./disabled-logger";
export {
  disabledSemanticLoggerProvider,
  consoleSemanticLoggerProvider,
  enableLogForTypes,
  ifEnabledSemanticLoggerProvider,
} from "./factory";

/**
 * Creates a semantic logger with a fixed context that is included in all log messages.
 *
 * @param context - Contextual metadata that will be included in every log entry
 *                  emitted by the returned logger. This is used to identify the source or scope
 *                  of log messages (e.g., `{ type: "ImportService" }` or `{ accountId: "123" }`).
 *
 * @returns A SemanticLogger instance that includes the provided context in all log output.
 *
 * @remarks
 * By convention, avoid using the following field names in the context object, as they
 * may conflict with fields added by the semantic logging implementation:
 * - `message` - The log message text
 * - `level` - The log level (debug, info, warn, error, panic)
 * - `provider` - The logging provider identifier
 * - `content` - Additional data passed to individual log calls
 *
 * Note: These field names are not enforced at compile-time or runtime, but using them
 * may result in unexpected behavior or field name collisions in log output.
 *
 * @example
 * ```typescript
 * // Create a logger for a service
 * const log = logProvider({ type: "ImportService" });
 *
 * // All logs from this logger will include { type: "ImportService" }
 * log.debug("Starting import");
 * // Output: { type: "ImportService", level: "debug", message: "Starting import" }
 *
 * log.info({ itemCount: 42 }, "Import complete");
 * // Output: { type: "ImportService", level: "info", content: { itemCount: 42 }, message: "Import complete" }
 * ```
 */
export type LogProvider = <Context extends object>(context: Jsonify<Context>) => SemanticLogger;
