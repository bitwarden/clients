import { Jsonify } from "type-fest";

import { DefaultSemanticLogger } from "./default-semantic-logger";
import { DISABLED_LOGGER } from "./disabled-logger";
import { LogService } from "./log.service";

import { LogProvider, SemanticLogger } from "./index";

/** Instantiates a semantic logger that emits nothing when a message
 *  is logged.
 *  @param _context a static payload that is cloned when the logger
 *   logs a message. The `messages`, `level`, and `content` fields
 *   are reserved for use by loggers.
 */
export function disabledSemanticLoggerProvider<Context extends object>(
  _context: Jsonify<Context>,
): SemanticLogger {
  return DISABLED_LOGGER;
}

/** Instantiates a semantic logger that emits logs to the console.
 *  @param logService writes semantic logs to the console
 */
export function consoleSemanticLoggerProvider(logService: LogService): LogProvider {
  function provider<Context extends object>(context: Jsonify<Context>) {
    const logger = new DefaultSemanticLogger(logService, context);

    warnLoggingEnabled(logService, "consoleSemanticLoggerProvider", context);
    return logger;
  }

  return provider;
}

/** Instantiates a semantic logger that emits logs to the console when the
 *  context's `type` matches its values.
 *  @param logService writes semantic logs to the console
 *  @param types the values to match against
 */
export function enableLogForTypes(logService: LogService, types: string[]): LogProvider {
  if (types.length) {
    warnLoggingEnabled(logService, "enableLogForTypes", { types });
  }

  function provider<Context extends object>(context: Jsonify<Context>) {
    const { type } = context as { type?: unknown };
    if (typeof type === "string" && types.includes(type)) {
      const logger = new DefaultSemanticLogger(logService, context);

      warnLoggingEnabled(logService, "enableLogForTypes", {
        targetType: type,
        available: types,
        loggerContext: context,
      });
      return logger;
    } else {
      return DISABLED_LOGGER;
    }
  }

  return provider;
}

/** Instantiates a semantic logger that emits logs to the console when its enabled.
 *  @param enable logs are emitted when this is true
 *  @param logService writes semantic logs to the console
 *  @param context a static payload that is cloned when the logger
 *   logs a message.
 *
 *  @remarks The `message`, `level`, `provider`, and `content` fields
 *   are reserved for use by the semantic logging system.
 */
export function ifEnabledSemanticLoggerProvider<Context extends object>(
  enable: boolean,
  logService: LogService,
  context: Jsonify<Context>,
) {
  if (enable) {
    const logger = new DefaultSemanticLogger(logService, context);

    warnLoggingEnabled(logService, "ifEnabledSemanticLoggerProvider", context);
    return logger;
  } else {
    return DISABLED_LOGGER;
  }
}

// show our GRIT - these functions implement generalized logging
//   controls and should return DISABLED_LOGGER in production.
function warnLoggingEnabled(logService: LogService, method: string, context?: any) {
  logService.warning({
    method,
    context,
    provider: "tools/log",
    message: "Semantic logging enabled. 🦟 Please report this bug if you see it 🦟",
  });
}
