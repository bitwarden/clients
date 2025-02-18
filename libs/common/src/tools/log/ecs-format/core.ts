/** Elastic Common Schema log format - core fields.
 */
export interface EcsFormat {
  "@timestamp": Date,

  /** custom key/value pairs */
  labels?: Record<string, string>,

  /** system message related to the event */
  message?: string,

  /** keywords tagging the event */
  tags?: Array<string>,

  /** describe the event; it is recommended that all events have these. */
  event: {
    kind?: "alert" | "enrichment" | "event" | "metric" | "state",
    category?: "api" | "authentication" | "iam" | "process" | "session" ,
    type?: "access" | "admin" | "allowed" | "creation" | "deletion" | "denied" | "end" | "error" | "info" | "start" | "user",
    outcome?: "failure" | "success" | "unknown",
  }
};
