import { expect, Page } from "@playwright/test";

import { confirmSimpleDialog } from "./simple-dialog";

/** Prefixes the request's id, e.g. `approvals-cell-item-<id>`. */
const ITEM_CELL = "approvals-cell-item-";
const APPROVE_BUTTON = "approvals-approve-";
const DENY_BUTTON = "approvals-deny-";
const WITHDRAW_BUTTON = "approvals-withdraw-";
const REVOKE_BUTTON = "approvals-revoke-";

const DECIDE_COMMENT_INPUT = "#pam-decide-dialog_textarea_comment";
const DECIDE_CONFIRM_BUTTON = "#pam-decide-dialog_button_confirm";
const WITHDRAW_REASON_INPUT = "#pam-withdraw-approval-dialog_textarea_reason";
const WITHDRAW_CONFIRM_BUTTON = "#pam-withdraw-approval-dialog_button_confirm";

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

  /** Withdraws an approval the requester has not started, which needs a reason. */
  async withdrawApproval(itemName: string, reason: string) {
    await this.page.getByTestId(WITHDRAW_BUTTON + (await this.requestId(itemName))).click();
    await this.page.locator(WITHDRAW_REASON_INPUT).fill(reason);
    const confirm = this.page.locator(WITHDRAW_CONFIRM_BUTTON);
    await confirm.click();
    await expect(confirm).toBeHidden();
  }

  /** Ends the requester's running lease, once confirmed. */
  async revoke(itemName: string) {
    const revoke = this.page.getByTestId(REVOKE_BUTTON + (await this.requestId(itemName)));
    await confirmSimpleDialog(this.page, () => revoke.click());
  }

  /**
   * Reloads the page, which re-reads the requests. Another user's change, such as the requester
   * starting access, reaches an open page only through push notifications.
   */
  async reload() {
    await this.page.reload();
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
