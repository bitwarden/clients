import { ElectronApplication } from "@playwright/test";

/** Ids of application menu items (apps/desktop/src/main/menu). */
export const MenuItem = Object.freeze({
  LockAll: "lockAllNow",
  Settings: "settings",
} as const);
export type MenuItem = (typeof MenuItem)[keyof typeof MenuItem];

/**
 * Clicks an application menu item, exactly as a user would. Native menus are outside
 * the renderer, so Playwright cannot reach them through the page.
 */
export async function clickMenuItem(app: ElectronApplication, id: MenuItem) {
  await app.evaluate(({ Menu }, itemId) => {
    const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
    if (item == null) {
      throw new Error(`No menu item ${itemId}`);
    }
    if (!item.enabled) {
      throw new Error(`Menu item ${itemId} is disabled`);
    }
    item.click();
  }, id);
}
