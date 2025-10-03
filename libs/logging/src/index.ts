import { Jsonify } from "type-fest";

import { SemanticLogger } from "./semantic-logger.abstraction";

export { LogService } from "./log.service";
export { LogLevel } from "./log-level";
export { ConsoleLogService } from "./console-log.service";
export { SemanticLogger } from "./semantic-logger.abstraction";

/** Creates a semantic logger.
 *  @param context all logs emitted by the logger are extended with
 *     these fields.
 *  @remarks The `message`, `level`, `provider`, and `content` fields
 *   are reserved for use by the semantic logging system.
 */
export type LogProvider = <Context extends object>(context: Jsonify<Context>) => SemanticLogger;
