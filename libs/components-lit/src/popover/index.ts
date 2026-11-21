/**
 * Popovers: contextual overlays anchored to an element.
 *
 * - `<bit-popover>` with `<bit-popover-header>` / `<bit-popover-footer>`.
 * - `attachPopoverTrigger(trigger, popover, options)` / `popoverTrigger()` directive: toggle on
 *   click (replaces `bitPopoverTriggerFor`).
 * - `attachPopoverAnchor(anchor, popover, { open })` / `popoverAnchor()` directive: programmatic
 *   (replaces `bitPopoverAnchorFor`).
 * - Declarative: `<bit-popover trigger="button-id">` or `<bit-popover anchor="id" open>`.
 * - `openPopover(popover, anchor, options)` returns a `PopoverRef` (replaces `PopoverService`).
 * - `spotlight` (replaces `SpotlightService`) and the overlay helpers in `overlay.ts`, shared by
 *   menus, dialogs and toasts (now in `core/overlay.ts`).
 */
export * from "./attach-popover";
export * from "./popover";
export * from "./popover-base";
export * from "./popover-directive";
export * from "./popover-footer";
export * from "./popover-header";
export * from "./popover-panel";
export * from "./popover-position";
export * from "./popover-ref";
export * from "./spotlight";
