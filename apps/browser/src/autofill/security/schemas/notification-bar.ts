/**
 * Schema for the notification-bar iframe boundary.
 *
 * Phase 4 §8.2 #2: validate `event.data` before any property access. The bar is
 * an iframe in a host page; messages can arrive from any window that has a
 * handle to its contentWindow. Object-identity (`event.source === parent`) and
 * origin equality are the existing defenses — this schema is the third layer.
 *
 * Two recognized commands (`initNotificationBar`, `saveCipherAttemptCompleted`)
 * plus any peripheral handler shape. Init carries an opaque `initData` payload
 * — passthrough lets it flow without the schema needing to enumerate every UI
 * config field.
 */

import { type inferType, v } from "../validators";

export const NotificationBarInboundSchema = v.object(
  {
    command: v.string({ min: 1, max: 100 }),
    data: v.optional(v.object({}, { passthrough: true })),
    error: v.optional(v.string({ max: 500 })),
    initData: v.optional(v.object({}, { passthrough: true })),
    parentOrigin: v.optional(v.string({ max: 200 })),
  },
  // Other bar handlers may attach short-lived ad-hoc fields (e.g. animation
  // hints). Passthrough preserves them; the dangerous-key reject is intact.
  { passthrough: true },
);

export type NotificationBarInbound = inferType<typeof NotificationBarInboundSchema>;
