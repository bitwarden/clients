import { Injectable } from "@angular/core";

import {
  DefaultRegistrationStartComponentService,
  RegistrationStartComponentService,
} from "@bitwarden/auth/angular";

@Injectable()
export class ExtensionRegistrationStartComponentService
  extends DefaultRegistrationStartComponentService
  implements RegistrationStartComponentService
{
  showDataEntryPageIcon = false;
  marketingEmailsLabelText = "receiveMarketingEmailsShort";
}
