/**
 * A cipher's leasing state from the current user's perspective — the shape the
 * vault-row and cipher-view lease badges render.
 *
 * - "unleased"           — cipher is not gated; opens normally.
 * - "gated_no_lease"     — gated, no active lease; opening surfaces the Request
 *                          Access modal so the user explicitly confirms before
 *                          any approval (automated or human).
 * - "gated_active_lease" — the caller already holds an active lease.
 */
export type GatedState = "unleased" | "gated_no_lease" | "gated_active_lease";
