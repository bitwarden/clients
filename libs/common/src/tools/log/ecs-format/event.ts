import { LogLevelType } from "../../../platform/enums";

import { EcsFormat } from "./core";

/** extends core event logs with additional information */
export type EventFormat = EcsFormat & {

  event: Partial<ProcessEvent> & Partial<ApplicationEvent> & {
    /** event severity as a number */
    severity?: LogLevelType,
  },
}

export type ProcessEvent = {
  start: Date,
  duration: number,
  end: Date,
};

export type ApplicationEvent = {
    /** source of the event; this is usually a client type or service name */
    provider: string,

    /** reason why the event occurred, according to the source */
    reason: string,

    /** reference URL for the event */
    reference: string,
};
