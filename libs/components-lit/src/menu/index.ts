/**
 * Menus: `<bit-menu>` with `<bit-menu-item>` and `<bit-menu-divider>`.
 *
 * - `attachMenuTrigger(trigger, menu, options)` / `menuTrigger(menu)` directive (replace
 *   `bitMenuTriggerFor`). The handle's `toggleOnRightClick(event)` opens a context menu.
 * - Declarative: `<bit-menu trigger="button-id">`.
 * - `data-bit-menu-close` (`MENU_CLOSE_ATTRIBUTE`) marks extra content that closes the menu
 *   (replaces `bitMenuClose`); `data-bit-menu-item` opts custom elements into keyboard navigation.
 * - `menuItemBaseStyles` / `menuItemPrimaryStyles` for menu-like components.
 */
export * from "./attach-menu";
export * from "./menu";
export * from "./menu-directive";
export * from "./menu-divider";
export * from "./menu-item";
export * from "./menu-positions";
export * from "./menu-styles";
