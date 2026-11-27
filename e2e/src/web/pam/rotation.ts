import { expect, Locator, Page } from "@playwright/test";

import { exactly } from "./exactly";
import { confirmSimpleDialog } from "./simple-dialog";

const ADD_BUTTON = "#rotation-shell_button_add";
const ADD_MANAGED_CREDENTIAL = "#rotation-shell_menu-item_add-managed-credential";
const ADD_ACCESS_CONNECTOR = "#rotation-shell_menu-item_add-access-connector";

const REGISTER_NAME_INPUT = "#access-connector-register-dialog_input_name";
const REGISTER_SUBMIT_BUTTON = "#access-connector-register-dialog_button_submit";
const TOKEN_TEXT = "#access-connector-token-dialog_text_token";
const TOKEN_STORED_CHECKBOX = "#access-connector-token-dialog_checkbox_stored";
const TOKEN_CLOSE_BUTTON = "#access-connector-token-dialog_button_close";

/** Each prefixes the row's id, e.g. `access-connectors-tab_button_detail-<id>`. */
const CONNECTOR_NAME_BUTTON = "access-connectors-tab_button_detail-";
const CONNECTOR_OPTIONS_BUTTON = "access-connectors-tab_button_menu-";
const CONNECTOR_ASSIGN_MENU_ITEM = "access-connectors-tab_button_assign-";
const CONNECTOR_DEACTIVATE_MENU_ITEM = "access-connectors-tab_button_deactivate-";
const CONNECTOR_ACTIVATE_MENU_ITEM = "access-connectors-tab_button_activate-";
const CONNECTOR_DELETE_MENU_ITEM = "access-connectors-tab_button_delete-";
const CONNECTORS_EMPTY_REGISTER_BUTTON = "#access-connectors-tab_button_register-empty";

const ASSIGN_TARGET_SELECT = "#assign-target-dialog_select_target";
const ASSIGN_TARGET_CONFIRM_BUTTON = "#assign-target-dialog_button_confirm";

const TARGET_SYSTEM_TEMPLATE_BUTTON = "#target-systems-empty-state_button_template-";
const TARGET_SYSTEM_NAME_BUTTON = "target-systems-tab_button_name-";

const TARGET_SYSTEM_NAME_INPUT = "#target-system-edit_input_name";
const TARGET_SYSTEM_ENDS_SESSIONS_CHECKBOX = "#target-system-edit_checkbox_session-termination";
const TARGET_SYSTEM_CHOSEN_CONNECTORS = "target-system-edit-chosen-connectors";
const TARGET_SYSTEM_SAVE_BUTTON = "#target-system-edit_button_save";

const CREDENTIAL_NAME_BUTTON = "managed-credentials-tab_button_name_";
const CREDENTIAL_OPTIONS_BUTTON = "managed-credentials-tab_menu-trigger_";
const CREDENTIAL_PAUSE_MENU_ITEM = "managed-credentials-tab_button_pause_";
const CREDENTIAL_RESUME_MENU_ITEM = "managed-credentials-tab_button_resume_";

const CREDENTIAL_ITEM_SELECT = "#rotation-config-edit_select_cipher";
const CREDENTIAL_TARGET_SYSTEM_SELECT = "#rotation-config-edit_select_target-system";
const CREDENTIAL_ACCOUNT_INPUT = "#rotation-config-edit_input_account-identity";
const CREDENTIAL_SAVE_BUTTON = "#rotation-config-edit_button_save";
const CREDENTIAL_VAULT_ITEM = "#rotation-config-edit_text_vault-item";
const CREDENTIAL_TARGET_SYSTEM = "#rotation-config-edit_text_target-system";
const CREDENTIAL_OPTIONS = "#rotation-config-edit_button_options";
const CREDENTIAL_ROTATE_NOW_LOCKED = "#rotation-config-edit_button_rotate-now-locked";
const CREDENTIAL_DELETE_LOCKED = "#rotation-config-edit_button_delete-locked";
const CREDENTIAL_HISTORY_JOB = "rotation-history-job-result";

export type RotationTab = "managed-credentials" | "target-systems" | "access-connectors";

/**
 * Starts a target system from one of the starter templates the empty Target systems tab offers,
 * which picks its method and system type.
 */
export type TargetSystemTemplate = "manual" | "entra" | "active-directory" | "custom-script";

/**
 * The Admin Console's credential rotation pages, `/organizations/{id}/pam/rotation`: managed
 * credentials, the target systems they rotate on, and the access connectors that rotate them.
 */
export class RotationPage {
  constructor(
    private readonly page: Page,
    private readonly organizationId: string,
  ) {}

  async goto(tab: RotationTab) {
    await this.page.goto(`/#/organizations/${this.organizationId}/pam/rotation/${tab}`);
  }

  /** The id of the row whose name button, with ids prefixed `prefix`, reads `name`. */
  async rowId(prefix: string, name: string): Promise<string> {
    const nameButton = this.nameButton(prefix, name);
    await expect(nameButton).toHaveCount(1);
    const id = await nameButton.getAttribute("id");
    return id!.slice(prefix.length);
  }

  /**
   * A row's name button. Rows render their ids only into the ids of their buttons, and a row
   * created through the client hands its id to no one, so the row is found by its name.
   */
  nameButton(prefix: string, name: string): Locator {
    return this.page.locator(`[id^="${prefix}"]`).filter({ hasText: exactly(name) });
  }

  async openAddMenu() {
    await this.page.locator(ADD_BUTTON).click();
  }
}

/** The Access connectors tab: the connectors that run rotations, each with its own token. */
export class AccessConnectorsTab {
  readonly emptyStateRegisterButton: Locator;
  private readonly rotation: RotationPage;

  constructor(
    private readonly page: Page,
    organizationId: string,
  ) {
    this.rotation = new RotationPage(page, organizationId);
    this.emptyStateRegisterButton = page.locator(CONNECTORS_EMPTY_REGISTER_BUTTON);
  }

  async goto() {
    await this.rotation.goto("access-connectors");
  }

  /**
   * Registers a connector, which shows its token once, in a dialog the caller closes. Closing it
   * leaves the connector's own page open.
   */
  async register(name: string): Promise<AccessConnectorTokenDialog> {
    await this.rotation.openAddMenu();
    await this.page.locator(ADD_ACCESS_CONNECTOR).click();
    await this.page.locator(REGISTER_NAME_INPUT).fill(name);
    await this.page.locator(REGISTER_SUBMIT_BUTTON).click();
    return new AccessConnectorTokenDialog(this.page);
  }

  /** Registers a connector, closes its token dialog, and returns to the list. */
  async registerAndDismissToken(name: string) {
    const tokenDialog = await this.register(name);
    await tokenDialog.confirmStoredAndClose();
    await this.goto();
    await expect(this.nameButton(name)).toBeVisible();
  }

  nameButton(name: string): Locator {
    return this.rotation.nameButton(CONNECTOR_NAME_BUTTON, name);
  }

  /** Opens the connector's options menu, whose items are keyed by the connector's id. */
  async openOptions(name: string): Promise<AccessConnectorOptions> {
    const id = await this.rotation.rowId(CONNECTOR_NAME_BUTTON, name);
    await this.page.locator(`#${CONNECTOR_OPTIONS_BUTTON}${id}`).click();
    return {
      assign: this.page.locator(`#${CONNECTOR_ASSIGN_MENU_ITEM}${id}`),
      deactivate: this.page.locator(`#${CONNECTOR_DEACTIVATE_MENU_ITEM}${id}`),
      activate: this.page.locator(`#${CONNECTOR_ACTIVATE_MENU_ITEM}${id}`),
      delete: this.page.locator(`#${CONNECTOR_DELETE_MENU_ITEM}${id}`),
    };
  }

  /** Stops the connector claiming rotations, once confirmed. */
  async deactivate(name: string) {
    const options = await this.openOptions(name);
    await confirmSimpleDialog(this.page, () => options.deactivate.click());
  }

  async activate(name: string) {
    const options = await this.openOptions(name);
    await options.activate.click();
    await expect(options.activate).toBeHidden();
  }

  /** Deletes the connector, once confirmed. */
  async delete(name: string) {
    const options = await this.openOptions(name);
    await confirmSimpleDialog(this.page, () => options.delete.click());
  }

  /** Lets the connector rotate credentials on an active automatic target system. */
  async assignTargetSystem(name: string, targetSystemName: string) {
    const options = await this.openOptions(name);
    await options.assign.click();
    await selectOption(this.page, ASSIGN_TARGET_SELECT, targetSystemName);
    const confirm = this.page.locator(ASSIGN_TARGET_CONFIRM_BUTTON);
    await confirm.click();
    await expect(confirm).toBeHidden();
  }
}

export type AccessConnectorOptions = {
  assign: Locator;
  deactivate: Locator;
  activate: Locator;
  delete: Locator;
};

/**
 * Shows a newly registered connector's token, the only time it is shown. Close stays disabled
 * until the admin confirms they stored it.
 */
export class AccessConnectorTokenDialog {
  readonly token: Locator;
  readonly storedCheckbox: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.token = page.locator(TOKEN_TEXT);
    this.storedCheckbox = page.locator(TOKEN_STORED_CHECKBOX);
    this.closeButton = page.locator(TOKEN_CLOSE_BUTTON);
  }

  async confirmStoredAndClose() {
    await this.storedCheckbox.check();
    await this.closeButton.click();
    await expect(this.closeButton).toBeHidden();
  }
}

/** The Target systems tab: the systems whose accounts managed credentials rotate on. */
export class TargetSystemsTab {
  private readonly rotation: RotationPage;

  constructor(
    private readonly page: Page,
    organizationId: string,
  ) {
    this.rotation = new RotationPage(page, organizationId);
  }

  async goto() {
    await this.rotation.goto("target-systems");
  }

  /** Starts a target system from a template, which only the empty tab offers. */
  async createFromTemplate(template: TargetSystemTemplate): Promise<TargetSystemEditPage> {
    await this.page.locator(TARGET_SYSTEM_TEMPLATE_BUTTON + template).click();
    return new TargetSystemEditPage(this.page);
  }

  /** Adds an automatic custom script target system, which an access connector can rotate on. */
  async addCustomScript(name: string) {
    await this.goto();
    const editPage = await this.createFromTemplate("custom-script");
    await editPage.name.fill(name);
    await editPage.save();
    await expect(this.nameButton(name)).toBeVisible();
  }

  nameButton(name: string): Locator {
    return this.rotation.nameButton(TARGET_SYSTEM_NAME_BUTTON, name);
  }

  async open(name: string): Promise<TargetSystemEditPage> {
    await this.nameButton(name).click();
    return new TargetSystemEditPage(this.page);
  }
}

/** The create and edit page of one target system. */
export class TargetSystemEditPage {
  readonly name: Locator;
  /** A custom script's opt-in to ending the account's sessions when its credential rotates. */
  readonly endsSessions: Locator;
  /** The connectors assigned to the system, by name. */
  readonly chosenConnectors: Locator;

  constructor(private readonly page: Page) {
    this.name = page.locator(TARGET_SYSTEM_NAME_INPUT);
    this.endsSessions = page.locator(TARGET_SYSTEM_ENDS_SESSIONS_CHECKBOX);
    this.chosenConnectors = page.getByTestId(TARGET_SYSTEM_CHOSEN_CONNECTORS);
  }

  /** Saves, which returns to the list. */
  async save() {
    const save = this.page.locator(TARGET_SYSTEM_SAVE_BUTTON);
    await save.click();
    await expect(save).toBeHidden();
  }
}

/** The Managed credentials tab: the vault items whose credentials rotate. */
export class ManagedCredentialsTab {
  private readonly rotation: RotationPage;

  constructor(
    private readonly page: Page,
    private readonly organizationId: string,
  ) {
    this.rotation = new RotationPage(page, organizationId);
  }

  async goto() {
    await this.rotation.goto("managed-credentials");
  }

  async add(): Promise<ManagedCredentialForm> {
    await this.rotation.openAddMenu();
    await this.page.locator(ADD_MANAGED_CREDENTIAL).click();
    return new ManagedCredentialForm(this.page);
  }

  /** The credential's name button, which reads its vault item's name. */
  nameButton(itemName: string): Locator {
    return this.rotation.nameButton(CREDENTIAL_NAME_BUTTON, itemName);
  }

  /** The credential's id, which its row carries. */
  async credentialId(itemName: string): Promise<string> {
    return this.rotation.rowId(CREDENTIAL_NAME_BUTTON, itemName);
  }

  async open(itemName: string): Promise<ManagedCredentialPage> {
    const id = await this.credentialId(itemName);
    await this.nameButton(itemName).click();
    return new ManagedCredentialPage(this.page, this.organizationId, id);
  }

  /** Opens the credential's options menu, whose items are keyed by the credential's id. */
  async openOptions(itemName: string): Promise<ManagedCredentialOptions> {
    const id = await this.credentialId(itemName);
    await this.page.locator(`#${CREDENTIAL_OPTIONS_BUTTON}${id}`).click();
    return {
      pause: this.page.locator(`#${CREDENTIAL_PAUSE_MENU_ITEM}${id}`),
      resume: this.page.locator(`#${CREDENTIAL_RESUME_MENU_ITEM}${id}`),
    };
  }

  /** Stops scheduling rotations of the credential, once confirmed. */
  async pause(itemName: string) {
    const options = await this.openOptions(itemName);
    await confirmSimpleDialog(this.page, () => options.pause.click());
  }

  async resume(itemName: string) {
    const options = await this.openOptions(itemName);
    await options.resume.click();
    await expect(options.resume).toBeHidden();
  }
}

export type ManagedCredentialOptions = {
  pause: Locator;
  resume: Locator;
};

/** Puts a vault item's credential under rotation on a target system. */
export class ManagedCredentialForm {
  /** The account on the target system whose credential rotates. */
  readonly account: Locator;

  constructor(private readonly page: Page) {
    this.account = page.locator(CREDENTIAL_ACCOUNT_INPUT);
  }

  async selectVaultItem(name: string) {
    await selectOption(this.page, CREDENTIAL_ITEM_SELECT, name);
  }

  async selectTargetSystem(name: string) {
    await selectOption(this.page, CREDENTIAL_TARGET_SYSTEM_SELECT, name);
  }

  /** Saves, which returns to the list. */
  async save() {
    const save = this.page.locator(CREDENTIAL_SAVE_BUTTON);
    await save.click();
    await expect(save).toBeHidden();
  }
}

/** One managed credential's page, with its configuration and rotation history tabs. */
export class ManagedCredentialPage {
  readonly vaultItem: Locator;
  readonly targetSystem: Locator;
  /** Rotate now in the options menu, while a rotation is running or no connector can run one. */
  readonly rotateNowLocked: Locator;
  /** Remove from rotation in the options menu, while a rotation is running. */
  readonly removeLocked: Locator;
  readonly historyJobs: Locator;

  constructor(
    private readonly page: Page,
    private readonly organizationId: string,
    readonly id: string,
  ) {
    this.vaultItem = page.locator(CREDENTIAL_VAULT_ITEM);
    this.targetSystem = page.locator(CREDENTIAL_TARGET_SYSTEM);
    this.rotateNowLocked = page.locator(CREDENTIAL_ROTATE_NOW_LOCKED);
    this.removeLocked = page.locator(CREDENTIAL_DELETE_LOCKED);
    this.historyJobs = page.getByTestId(CREDENTIAL_HISTORY_JOB);
  }

  async goto(tab: "configuration" | "history") {
    await this.page.goto(
      `/#/organizations/${this.organizationId}/pam/rotation/managed-credentials/${this.id}/${tab}`,
    );
  }

  async openOptions() {
    await this.page.locator(CREDENTIAL_OPTIONS).click();
  }
}

/**
 * Picks the option of a component library select that reads `name`. Its options carry no test
 * ids, and an option's accessible name may add a status after the name, e.g. a target system with
 * no connected connector.
 */
async function selectOption(page: Page, selector: string, name: string) {
  await page.locator(selector).click();
  await page
    .getByRole("option")
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
}
