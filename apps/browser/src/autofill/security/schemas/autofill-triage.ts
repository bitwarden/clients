/**
 * Schemas for the autofill-triage channel group.
 *
 * These shapes are exercised by Phase 0's four migrated channels (warm-up
 * retrofit per §5.B.5). Keep them minimal — the schema is a security gate, not
 * a documentation surface. Anything not in the schema is rejected.
 */

import { type inferType, v } from "../validators";

export const CollectAutofillTriageSchema = v.object({
  command: v.literal("collectAutofillTriage"),
  _envPair: v.literal("popup:background"),
  tabId: v.number({ int: true, min: 0 }),
});
export type CollectAutofillTriage = inferType<typeof CollectAutofillTriageSchema>;
