import { expect, Locator, Page } from "@playwright/test";

import { confirmSimpleDialog } from "./simple-dialog";

const REQUEST_CARD = "cipher-view-banner-request";
const UNLICENSED_CARD = "cipher-view-banner-unlicensed";
const PENDING_CARD = "cipher-view-banner-pending";
const APPROVED_CARD = "cipher-view-banner-approved";
const ACTIVE_LEASE_CARD = "cipher-view-banner-active";
const REQUEST_TOGGLE_BUTTON = "#pam-cipher-view-banner_button_request-toggle";
const AUTOMATIC_REASON_INPUT = "#pam-cipher-view-banner_textarea_automatic-reason";
const HUMAN_REASON_INPUT = "#pam-cipher-view-banner_textarea_human-reason";
const REQUEST_SUBMIT_BUTTON = "#pam-cipher-view-banner_button_request-submit";
const CANCEL_REQUEST_BUTTON = "#pam-cipher-view-banner_button_cancel";
const START_ACCESS_BUTTON = "#pam-cipher-view-banner_button_start";
const END_LEASE_BUTTON = "#pam-cipher-view-banner_button_end";

const PASSWORD_FIELD = "login-password";
const PASSWORD_TOGGLE = "toggle-password";
const REVEALED_PASSWORD = "login-password-color";

/**
 * An item in a shared folder an access rule governs, opened from the web vault. The PAM banner
 * above its fields shows the member's access, and offers to request it.
 */
export class GatedItem {
  readonly requestCard: Locator;
  readonly unlicensedCard: Locator;
  readonly pendingCard: Locator;
  readonly approvedCard: Locator;
  readonly activeLeaseCard: Locator;
  readonly requestAccessButton: Locator;
  /** Absent until the member holds a lease, since the server withholds the password. */
  readonly passwordField: Locator;
  /** Holds the password twice: once a character at a time, and once for screen readers. */
  readonly revealedPassword: Locator;

  constructor(
    private readonly page: Page,
    private readonly cipherId: string,
  ) {
    this.requestCard = page.getByTestId(REQUEST_CARD);
    this.unlicensedCard = page.getByTestId(UNLICENSED_CARD);
    this.pendingCard = page.getByTestId(PENDING_CARD);
    this.approvedCard = page.getByTestId(APPROVED_CARD);
    this.activeLeaseCard = page.getByTestId(ACTIVE_LEASE_CARD);
    this.requestAccessButton = page.locator(REQUEST_TOGGLE_BUTTON);
    this.passwordField = page.getByTestId(PASSWORD_FIELD);
    this.revealedPassword = page.getByTestId(REVEALED_PASSWORD);
  }

  /**
   * Opens the item through the vault's deep link, which works in both vault layouts. Neither
   * layout's row carries a test id.
   */
  async open() {
    await this.page.goto(`/#/vault?itemId=${this.cipherId}`);
  }

  /**
   * Closes and opens the item again, which re-reads the member's access. Another user's decision
   * reaches an open item only through push notifications, which a local server may not run.
   */
  async reopen() {
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByRole("dialog")).toHaveCount(0);
    await this.open();
  }

  /**
   * Requests access with the rule's default duration, or its default window when an approver
   * decides. The form asks for one or the other once it has read the rule.
   */
  async requestAccess(reason: string) {
    await this.requestAccessButton.click();
    await this.page
      .locator(AUTOMATIC_REASON_INPUT)
      .or(this.page.locator(HUMAN_REASON_INPUT))
      .fill(reason);
    await this.page.locator(REQUEST_SUBMIT_BUTTON).click();
    await expect(this.page.locator(REQUEST_SUBMIT_BUTTON)).toBeHidden();
  }

  /** Withdraws the pending request, once confirmed. */
  async cancelRequest() {
    await confirmSimpleDialog(this.page, () => this.page.locator(CANCEL_REQUEST_BUTTON).click());
  }

  /** Starts the lease of an approved request, whose countdown runs from then. */
  async startAccess() {
    await this.page.locator(START_ACCESS_BUTTON).click();
  }

  /** Ends the member's lease early, once confirmed. */
  async endAccess() {
    await confirmSimpleDialog(this.page, () => this.page.locator(END_LEASE_BUTTON).click());
  }

  async revealPassword() {
    await this.page.getByTestId(PASSWORD_TOGGLE).click();
  }
}
