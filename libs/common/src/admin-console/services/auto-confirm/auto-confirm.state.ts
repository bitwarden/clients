import { AUTO_CONFIRM, UserKeyDefinition } from "../../../platform/state";

export class AutoConfirmState {
  enabled: boolean;
  showSetupDialog: boolean;
  showBrowserNotification: boolean | undefined;

  constructor() {
    this.enabled = false;
    this.showSetupDialog = true;
  }
}

export const AUTO_CONFIRM_STATE = UserKeyDefinition.record<AutoConfirmState>(
  AUTO_CONFIRM,
  "autoConfirm",
  {
    deserializer: (autoConfirmState) => autoConfirmState,
    clearOn: ["logout"],
  },
);
