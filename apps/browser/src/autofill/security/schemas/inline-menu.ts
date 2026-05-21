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

// Required fields are the ones the container itself reads in
// `handleInitInlineMenuIframe`. Other declared fields on the type
// (authStatus, theme, translations, ciphers, token) are forwarded to the
// inline-menu page but never accessed here — they're allowed through via
// passthrough so adding a new optional init field doesn't require a schema
// change here.
const InitMessageBase = {
  command: v.union(
    v.literal("initAutofillInlineMenuButton"),
    v.literal("initAutofillInlineMenuList"),
  ),
  iframeUrl: v.string({ min: 1, max: 2048 }),
  pageTitle: v.string({ max: 200 }),
  portName: v.string({ min: 1, max: 200 }),
  portKey: v.optional(v.string({ max: 200 })),
  styleSheetUrl: v.optional(v.string({ max: 2048 })),
  extensionOrigin: v.optional(v.string({ max: 200 })),
};

export const InlineMenuInitSchema = v.object(InitMessageBase, { passthrough: true });

/**
 * Relay messages have a known `command` (one of 15 in `RELAY_COMMANDS`), a
 * portKey and token, plus command-specific extras. The container never reads
 * the extras — they're forwarded to the port for the background to validate.
 */
export const InlineMenuRelaySchema = v.object(
  {
    command: v.enum(RELAY_COMMANDS),
    portKey: v.string({ min: 1, max: 200 }),
    // token is only present on the iframe → background path; parent → iframe
    // forwarded messages don't carry it. `isValidSessionToken` is the explicit
    // gate on the iframe → background path that enforces presence.
    token: v.optional(v.string({ min: 1, max: 200 })),
  },
  { passthrough: true },
);

export const InlineMenuInboundSchema = v.union(InlineMenuInitSchema, InlineMenuRelaySchema);
export type InlineMenuInbound = inferType<typeof InlineMenuInboundSchema>;
