import { KeyDefinitionLike, MigrationHelper, StateDefinitionLike } from "../migration-helper";
import { IRREVERSIBLE, Migrator } from "../migrator";

const DESKTOP_SETTINGS_STATE: StateDefinitionLike = { name: "desktopSettings" };

const CLOSE_TO_TRAY_KEY: KeyDefinitionLike = {
  key: "closeToTray",
  stateDefinition: DESKTOP_SETTINGS_STATE,
};
const RUN_IN_BACKGROUND_KEY: KeyDefinitionLike = {
  key: "runInBackground",
  stateDefinition: DESKTOP_SETTINGS_STATE,
};
const TRAY_ENABLED_KEY: KeyDefinitionLike = {
  key: "trayEnabled",
  stateDefinition: DESKTOP_SETTINGS_STATE,
};
const MINIMIZE_TO_TRAY_KEY: KeyDefinitionLike = {
  key: "minimizeToTray",
  stateDefinition: DESKTOP_SETTINGS_STATE,
};
const ALWAYS_SHOW_DOCK_KEY: KeyDefinitionLike = {
  key: "alwaysShowDock",
  stateDefinition: DESKTOP_SETTINGS_STATE,
};

/**
 * Consolidates the legacy `trayEnabled`, `minimizeToTray`, and `closeToTray` desktop settings
 * into a single "run in the background" setting, stored under the new `runInBackground` key.
 * `runInBackground = closeToTray || trayEnabled`. The now-unused `closeToTray`, `trayEnabled`,
 * `minimizeToTray`, and `alwaysShowDock` keys are removed.
 */
export class ConsolidateTrayToRunInBackground extends Migrator<79, 80> {
  async migrate(helper: MigrationHelper): Promise<void> {
    const closeToTray = await helper.getFromGlobal<boolean>(CLOSE_TO_TRAY_KEY);
    const trayEnabled = await helper.getFromGlobal<boolean>(TRAY_ENABLED_KEY);

    // Only write a consolidated value when at least one legacy value existed, so users who
    // never customized these keep falling through to the `!isDev()` default in the service.
    if (closeToTray != null || trayEnabled != null) {
      await helper.setToGlobal(RUN_IN_BACKGROUND_KEY, Boolean(closeToTray) || Boolean(trayEnabled));
    }

    // Remove orphaned keys (guarded so absent keys aren't touched).
    if (closeToTray != null) {
      await helper.removeFromGlobal(CLOSE_TO_TRAY_KEY);
    }
    if (trayEnabled != null) {
      await helper.removeFromGlobal(TRAY_ENABLED_KEY);
    }
    if ((await helper.getFromGlobal<boolean>(MINIMIZE_TO_TRAY_KEY)) != null) {
      await helper.removeFromGlobal(MINIMIZE_TO_TRAY_KEY);
    }
    if ((await helper.getFromGlobal<boolean>(ALWAYS_SHOW_DOCK_KEY)) != null) {
      await helper.removeFromGlobal(ALWAYS_SHOW_DOCK_KEY);
    }
  }

  rollback(helper: MigrationHelper): Promise<void> {
    throw IRREVERSIBLE;
  }
}
