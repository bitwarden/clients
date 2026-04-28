import { RegistrationStartComponentService } from "./registration-start-component.service";

export class DefaultRegistrationStartComponentService implements RegistrationStartComponentService {
  shouldShowUserDataEntryPageIcon = true;
  marketingEmailsLabelText = { key: "receiveMarketingEmailsV2" };
  showMarketingEmailsUnsubscribeLink = true;
}
