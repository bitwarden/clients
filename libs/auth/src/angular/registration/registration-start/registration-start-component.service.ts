import { LoginComponentTranslation } from "../../login/login-component.service";

export abstract class RegistrationStartComponentService {
  /** When false, the page icon is hidden during the user data entry state. */
  abstract shouldShowUserDataEntryPageIcon: boolean;

  /** The marketing emails checkbox label text. */
  abstract marketingEmailsLabelText: string | LoginComponentTranslation;

  /** When false, the unsubscribe link is hidden from the marketing emails label. */
  abstract showMarketingEmailsUnsubscribeLink: boolean;
}
