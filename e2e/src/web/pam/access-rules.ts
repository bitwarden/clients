import { expect, Locator, Page } from "@playwright/test";

const EMPTY_STATE = "access-rules-empty-state";
const EMPTY_STATE_CREATE_BUTTON = "#access-rules-empty-state_button_create";
const NAME_LINK = "access-rules-name-link";
const SHARED_FOLDERS_BADGE = "access-rule-collection-badges-badge";
const ACTIVE_BADGE = "access-rules-active-badge";
const INACTIVE_BADGE = "access-rules-inactive-badge";
const ROW_OPTIONS_BUTTON = "access-rules-row-options-button";
const DEACTIVATE_MENU_ITEM = "access-rules-deactivate-menu-item";
const DELETE_MENU_ITEM = "access-rules-delete-menu-item";

const EDIT_NAME_INPUT = "#access-rule-edit_input_name";
const EDIT_DESCRIPTION_INPUT = "#access-rule-edit_textarea_description";
const EDIT_SHARED_FOLDERS_SELECT = "access-rule-edit-shared-folders-select";
const EDIT_SAVE_BUTTON = "#access-rule-edit_button_save";

/** The Admin Console's PAM access rules list, `/organizations/{id}/pam/access-rules`. */
export class AccessRulesPage {
  readonly emptyState: Locator;

  constructor(private readonly page: Page) {
    this.emptyState = page.getByTestId(EMPTY_STATE);
  }

  async goto(organizationId: string) {
    await this.page.goto(`/#/organizations/${organizationId}/pam/access-rules`);
  }

  /** Opens the create page from the empty state, which is all an organization without rules shows. */
  async createFromEmptyState(): Promise<AccessRuleEditPage> {
    await this.page.locator(EMPTY_STATE_CREATE_BUTTON).click();
    return new AccessRuleEditPage(this.page);
  }

  /**
   * The rule's table row. The table renders its rows itself and takes no attributes for them, so
   * the row is the one holding the rule's name link.
   */
  row(name: string): Locator {
    return this.page
      .getByRole("row")
      .filter({ has: this.page.getByTestId(NAME_LINK).filter({ hasText: exactly(name) }) });
  }

  activeBadge(name: string): Locator {
    return this.row(name).getByTestId(ACTIVE_BADGE);
  }

  inactiveBadge(name: string): Locator {
    return this.row(name).getByTestId(INACTIVE_BADGE);
  }

  /** The count of shared folders the rule governs. Hovering it names them. */
  sharedFoldersBadge(name: string): Locator {
    return this.row(name).getByTestId(SHARED_FOLDERS_BADGE);
  }

  async openRule(name: string): Promise<AccessRuleEditPage> {
    await this.row(name).getByTestId(NAME_LINK).click();
    return new AccessRuleEditPage(this.page);
  }

  async deactivate(name: string) {
    await this.row(name).getByTestId(ROW_OPTIONS_BUTTON).click();
    await this.page.getByTestId(DEACTIVATE_MENU_ITEM).click();
    await this.confirm();
  }

  async delete(name: string) {
    await this.row(name).getByTestId(ROW_OPTIONS_BUTTON).click();
    await this.page.getByTestId(DELETE_MENU_ITEM).click();
    await this.confirm();
  }

  /**
   * Accepts the confirmation dialog. It is the component library's simple dialog, which carries no
   * test ids; its accept button is its first, the one it focuses on open.
   */
  private async confirm() {
    const dialog = this.page.getByRole("dialog");
    await dialog.getByRole("button").first().click();
    await expect(dialog).toBeHidden();
  }
}

/** The create and edit page of one access rule. */
export class AccessRuleEditPage {
  readonly name: Locator;
  readonly description: Locator;

  constructor(private readonly page: Page) {
    this.name = page.locator(EDIT_NAME_INPUT);
    this.description = page.locator(EDIT_DESCRIPTION_INPUT);
  }

  /** Picks a shared folder for the rule to govern. */
  async addSharedFolder(name: string) {
    await this.page.getByTestId(EDIT_SHARED_FOLDERS_SELECT).click();
    await this.page.keyboard.type(name);
    // The component library's multi-select carries no test ids on its options, which it lists in
    // an overlay once the folders load.
    await this.page.getByRole("option", { name: exactly(name) }).click();
    // Escape would discard the pick; leaving the field closes the dropdown and keeps it.
    await this.page.keyboard.press("Tab");
  }

  /** Saves, which returns to the list. */
  async save() {
    await this.page.locator(EDIT_SAVE_BUTTON).click();
    await expect(this.page.locator(EDIT_SAVE_BUTTON)).toBeHidden();
  }
}

/** Matches the whole of an element's text, so one name never matches another it prefixes. */
function exactly(text: string): RegExp {
  return new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`);
}
