import { expect, Page } from "@playwright/test";

/** Prefixes the request's id, e.g. `approvals-cell-item-<id>`. */
const ITEM_CELL = "approvals-cell-item-";
const APPROVE_BUTTON = "approvals-approve-";
const DENY_BUTTON = "approvals-deny-";

const DECIDE_COMMENT_INPUT = "#pam-decide-dialog_textarea_comment";
const DECIDE_CONFIRM_BUTTON = "#pam-decide-dialog_button_confirm";

/** The approver's inbox, `/pam/approvals`, listing requests on the shared folders they manage. */
export class ApprovalsPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/#/pam/approvals");
  }

  async approve(itemName: string) {
    await this.page.getByTestId(APPROVE_BUTTON + (await this.requestId(itemName))).click();
    await this.confirmDecision();
  }

  /** Denies the request, which needs a reason. */
  async deny(itemName: string, reason: string) {
    await this.page.getByTestId(DENY_BUTTON + (await this.requestId(itemName))).click();
    await this.page.locator(DECIDE_COMMENT_INPUT).fill(reason);
    await this.confirmDecision();
  }

  /**
   * The id of the one request listed for the item. Rows are keyed by request id, which a request
   * made through the client hands to no one, so it is read off the item's cell.
   */
  private async requestId(itemName: string): Promise<string> {
    const cell = this.page.locator(`[data-testid^="${ITEM_CELL}"]`).filter({ hasText: itemName });
    await expect(cell).toHaveCount(1);
    const testId = await cell.getAttribute("data-testid");
    return testId!.slice(ITEM_CELL.length);
  }

  private async confirmDecision() {
    const confirm = this.page.locator(DECIDE_CONFIRM_BUTTON);
    await confirm.click();
    await expect(confirm).toBeHidden();
  }
}
