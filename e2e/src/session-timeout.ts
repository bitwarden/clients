import { expect, Page } from "@playwright/test";

import { automationDriver } from "./automation-driver";
import { confirmSimpleDialog } from "./web/pam/simple-dialog";

// libs/key-management-ui/src/session-timeout/components.
const TIMEOUT_SELECT = "session-timeout-input-select";
const ACTION_SELECT = "session-timeout-settings-action-select";

const ACTION_STATE = { stateName: "vaultTimeoutSettings", key: "vaultTimeoutAction" };

/** Session timeouts the select offers, as stored (`VaultTimeoutStringType`). */
export const SessionTimeout = Object.freeze({
  OnSystemLock: "onLocked",
} as const);
export type SessionTimeout = (typeof SessionTimeout)[keyof typeof SessionTimeout];

/** Session timeout actions, as stored (`VaultTimeoutAction`). */
export const SessionTimeoutAction = Object.freeze({
  Lock: "lock",
  LogOut: "logOut",
} as const);
export type SessionTimeoutAction = (typeof SessionTimeoutAction)[keyof typeof SessionTimeoutAction];

// Option labels in the English locale. The rows the select draws carry no test ids.
const TIMEOUT_LABELS: Record<SessionTimeout, string> = {
  onLocked: "On system lock",
};
const ACTION_LABELS: Record<SessionTimeoutAction, string> = {
  lock: "Lock",
  logOut: "Log out",
};

type StateCapability = {
  readUser(userId: string, address: typeof ACTION_STATE): Promise<unknown>;
};

/** The session timeout action stored for `userId`, or null when none is stored. */
export function storedSessionTimeoutAction(page: Page, userId: string): Promise<unknown> {
  return automationDriver<StateCapability>(page, "state").readUser(userId, ACTION_STATE);
}

/**
 * Drives the session timeout settings shared by the desktop settings dialog and the extension's
 * account security page (libs/key-management-ui session-timeout-settings.component).
 */
export class SessionTimeoutSettings {
  constructor(private page: Page) {}

  async setTimeout(timeout: SessionTimeout) {
    await this.choose(TIMEOUT_SELECT, TIMEOUT_LABELS[timeout]);
  }

  /** "Log out" asks for confirmation before it is saved. */
  async setAction(action: SessionTimeoutAction) {
    const choose = () => this.choose(ACTION_SELECT, ACTION_LABELS[action]);

    if (action === SessionTimeoutAction.LogOut) {
      await confirmSimpleDialog(this.page, choose);
    } else {
      await choose();
    }
  }

  /**
   * `bit-select` draws its rows in a panel attached to `<body>`, away from the select. The open
   * combobox names that panel, which scopes the row to this select.
   */
  private async choose(selectTestId: string, label: string) {
    const select = this.page.getByTestId(selectTestId);
    await select.click();

    const combobox = select.getByRole("combobox");
    await expect(combobox).toHaveAttribute("aria-controls", /.+/);
    const panelId = await combobox.getAttribute("aria-controls");

    await this.page
      .locator(`[id="${panelId}"]`)
      .getByRole("option", { name: label, exact: true })
      .click();
  }
}
