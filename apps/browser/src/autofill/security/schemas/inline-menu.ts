/**
 * Schemas for inline-menu iframe boundary traffic.
 *
 * Phase 4 §8.1: validate `event.data` at the top of the inline menu container's
 * `handleWindowMessage`, before any property access. The iframe lives in an
 * untrusted host page; any host-script may call `iframe.contentWindow.postMessage`
 * with arbitrary data.
 *
 * Two shapes flow through the boundary:
 *
 * 1. **Init** — `initAutofillInlineMenuButton` / `initAutofillInlineMenuList`.
 *    The container reads every field, so the schema is strict.
 * 2. **Relay** — one of 15 commands forwarded between iframe and background.
 *    The container does not read the body beyond `command`/`portKey`/`token`;
 *    command-specific extras are passed through unchanged. The downstream
 *    receiver (background or inline-menu page) is responsible for its own
 *    strict schema validation.
 */

import { type inferType, v } from "../validators";

// Commands that the inline-menu container relays from the inline-menu iframe
// to the background. Kept in sync with `ALLOWED_BG_COMMANDS` in
// `autofill-inline-menu-container.ts`.
const RELAY_COMMANDS = [
  "addNewVaultItem",
  "autofillInlineMenuBlurred",
  "autofillInlineMenuButtonClicked",
  "checkAutofillInlineMenuButtonFocused",
  "checkInlineMenuButtonFocused",
  "fillAutofillInlineMenuCipher",
  "fillGeneratedPassword",
  "redirectAutofillInlineMenuFocusOut",
  "refreshGeneratedPassword",
  "refreshOverlayCiphers",
  "triggerDelayedAutofillInlineMenuClosure",
  "updateAutofillInlineMenuColorScheme",
  "updateAutofillInlineMenuListHeight",
  "unlockVault",
  "viewSelectedCipher",
] as const;

const InitMessageBase = {
  command: v.union(
    v.literal("initAutofillInlineMenuButton"),
    v.literal("initAutofillInlineMenuList"),
  ),
  portKey: v.string({ min: 1, max: 200 }),
  token: v.string({ min: 1, max: 200 }),
  iframeUrl: v.string({ min: 1, max: 2048 }),
  pageTitle: v.string({ max: 200 }),
  authStatus: v.number({ int: true, min: 0, max: 4 }),
  styleSheetUrl: v.string({ max: 2048 }),
  theme: v.string({ max: 50 }),
  translations: v.object({}, { passthrough: true }),
  // ciphers may be null (pre-unlock) or an array of opaque cipher view records;
  // the init handler does not access cipher internals at the boundary.
  ciphers: v.optional(v.array(v.object({}, { passthrough: true }))),
  portName: v.string({ min: 1, max: 200 }),
  extensionOrigin: v.optional(v.string({ max: 200 })),
};

export const InlineMenuInitSchema = v.object(InitMessageBase);

/**
 * Relay messages have a known `command` (one of 15 in `RELAY_COMMANDS`), a
 * portKey and token, plus command-specific extras. The container never reads
 * the extras — they're forwarded to the port for the background to validate.
 */
export const InlineMenuRelaySchema = v.object(
  {
    command: v.enum(RELAY_COMMANDS),
    portKey: v.string({ min: 1, max: 200 }),
    token: v.string({ min: 1, max: 200 }),
  },
  { passthrough: true },
);

export const InlineMenuInboundSchema = v.union(InlineMenuInitSchema, InlineMenuRelaySchema);
export type InlineMenuInbound = inferType<typeof InlineMenuInboundSchema>;
