import { expect, Locator, Page } from "@playwright/test";

const REQUEST_CARD = "cipher-view-banner-request";
const UNLICENSED_CARD = "cipher-view-banner-unlicensed";
const APPROVED_CARD = "cipher-view-banner-approved";
const ACTIVE_LEASE_CARD = "cipher-view-banner-active";
const REQUEST_TOGGLE_BUTTON = "#pam-cipher-view-banner_button_request-toggle";
const REQUEST_REASON_INPUT = "#pam-cipher-view-banner_textarea_automatic-reason";
const REQUEST_SUBMIT_BUTTON = "#pam-cipher-view-banner_button_request-submit";
const START_ACCESS_BUTTON = "#pam-cipher-view-banner_button_start";

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
  readonly approvedCard: Locator;
  readonly activeLeaseCard: Locator;
  readonly requestAccessButton: Locator;
  /** Absent until the member holds a lease, since the server withholds the password. */
  readonly passwordField: Locator;
  /** Holds the password twice: once a character at a time, and once for screen readers. */
  readonly revealedPassword: Locator;

  constructor(private readonly page: Page) {
    this.requestCard = page.getByTestId(REQUEST_CARD);
    this.unlicensedCard = page.getByTestId(UNLICENSED_CARD);
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
  async open(cipherId: string) {
    await this.page.goto(`/#/vault?itemId=${cipherId}`);
  }

  /** Requests access under a rule that approves on its own, keeping the default duration. */
  async requestAccess(reason: string) {
    await this.requestAccessButton.click();
    await this.page.locator(REQUEST_REASON_INPUT).fill(reason);
    await this.page.locator(REQUEST_SUBMIT_BUTTON).click();
    await expect(this.page.locator(REQUEST_SUBMIT_BUTTON)).toBeHidden();
  }

  /** Starts the lease of an approved request, whose countdown runs from then. */
  async startAccess() {
    await this.page.locator(START_ACCESS_BUTTON).click();
  }

  async revealPassword() {
    await this.page.getByTestId(PASSWORD_TOGGLE).click();
  }
}
