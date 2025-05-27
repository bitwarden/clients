import { LogService } from "../../platform/abstractions/log.service";

// show our GRIT - these functions implement generalized logging
//   controls and should return DISABLED_LOGGER in production.
export function warnLoggingEnabled(logService: LogService, method: string, context?: any) {
  logService.warning({
    method,
    context,
    provider: "tools/log",
    message: "Semantic logging enabled. 🦟 Please report this bug if you see it 🦟",
  });
}
