import { expect, Locator, Page, Response } from "@playwright/test";

import { confirmSimpleDialog } from "./simple-dialog";

const REQUEST_CARD = "cipher-view-banner-request";
const UNLICENSED_CARD = "cipher-view-banner-unlicensed";
const PENDING_CARD = "cipher-view-banner-pending";
const APPROVED_CARD = "cipher-view-banner-approved";
const ACTIVE_LEASE_CARD = "cipher-view-banner-active";
const UNAVAILABLE_CARD = "cipher-view-banner-unavailable";
const LEASE_ENDS_AT = "active-lease-ends-at";
const REQUEST_TOGGLE_BUTTON = "#pam-cipher-view-banner_button_request-toggle";
const AUTOMATIC_REASON_INPUT = "#pam-cipher-view-banner_textarea_automatic-reason";
const HUMAN_REASON_INPUT = "#pam-cipher-view-banner_textarea_human-reason";
const REQUEST_SUBMIT_BUTTON = "#pam-cipher-view-banner_button_request-submit";
const CANCEL_REQUEST_BUTTON = "#pam-cipher-view-banner_button_cancel";
const START_ACCESS_BUTTON = "#pam-cipher-view-banner_button_start";
const END_LEASE_BUTTON = "#pam-cipher-view-banner_button_end";
const EXTEND_LEASE_BUTTON = "#pam-cipher-view-banner_button_extend";
const EXTEND_REASON_INPUT = "#extend-lease-dialog_textarea_reason";
const EXTEND_SUBMIT_BUTTON = "#extend-lease-dialog_button_submit";

/** The server's start endpoint, `/access-requests/<id>/activate`. */
const ACTIVATE_REQUEST_PATH = /\/access-requests\/[^/]+\/activate$/;

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
  /** Shown in place of a request when the rule refuses one right now, e.g. outside its IP allowlist. */
  readonly unavailableCard: Locator;
  readonly requestAccessButton: Locator;
  readonly extendAccessButton: Locator;
  /** When the running lease ends, as a time of day, and a date unless it is today. */
  readonly leaseEndsAt: Locator;
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
    this.unavailableCard = page.getByTestId(UNAVAILABLE_CARD);
    this.requestAccessButton = page.locator(REQUEST_TOGGLE_BUTTON);
    this.extendAccessButton = page.locator(EXTEND_LEASE_BUTTON);
    this.leaseEndsAt = page.getByTestId(LEASE_ENDS_AT);
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

  /**
   * Starts the lease of an approved request, whose countdown runs from then. Resolves with the
   * server's answer, since a refused start leaves the approved card as it was. Its error toast is
   * out of reach: the open item hides the rest of the page, toasts included, from the
   * accessibility tree.
   */
  async startAccess(): Promise<Response> {
    const answered = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        ACTIVATE_REQUEST_PATH.test(new URL(response.url()).pathname),
    );
    await this.page.locator(START_ACCESS_BUTTON).click();
    return answered;
  }

  /** Ends the member's lease early, once confirmed. */
  async endAccess() {
    await confirmSimpleDialog(this.page, () => this.page.locator(END_LEASE_BUTTON).click());
  }

  /** Extends the running lease by the shortest duration the rule allows. */
  async extendAccess(reason: string) {
    await this.extendAccessButton.click();
    await this.page.locator(EXTEND_REASON_INPUT).fill(reason);
    const submit = this.page.locator(EXTEND_SUBMIT_BUTTON);
    await submit.click();
    await expect(submit).toBeHidden();
  }

  async revealPassword() {
    await this.page.getByTestId(PASSWORD_TOGGLE).click();
  }
}
