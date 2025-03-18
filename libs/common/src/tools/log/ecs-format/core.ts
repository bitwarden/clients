import { Primitive } from "type-fest";

export type EcsEventType =
  | "access"
  | "admin"
  | "allowed"
  | "creation"
  | "deletion"
  | "denied"
  | "end"
  | "error"
  | "info"
  | "start"
  | "user";

/** Elastic Common Schema log format - core fields.
 */
export interface EcsFormat {
  "@timestamp": number;

  /** custom key/value pairs */
  labels?: Record<string, Primitive>;

  /** system message related to the event (for humans) */
  message?: string;

  /** keywords tagging the event */
  tags?: Array<string>;

  /** describe the event; it is recommended that all events have these. */
  event: {
    kind?: "alert" | "enrichment" | "event" | "metric" | "state";
    category?: "api" | "authentication" | "iam" | "process" | "session";
    type?: EcsEventType;
    outcome?: "failure" | "success" | "unknown";
  };
}
