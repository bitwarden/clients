/**
 * TypeScript representation of FlightRecorderEvent from Rust SDK.
 * Generated via Tsify - must match Rust struct exactly.
 */
export interface FlightRecorderLogData {
  /** Unix timestamp in milliseconds */
  timestamp: number;

  /** Log level (trace, debug, info, warn, error) */
  level: string;

  /** Target module (e.g., "bitwarden_core::client") */
  target: string;

  /** Primary message */
  message: string;

  /** Structured fields from tracing events */
  fields: Record<string, string>;
}
