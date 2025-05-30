import { Component } from "@angular/core";

import { PolicyType } from "@bitwarden/common/admin-console/enums";

import { BasePolicy, BasePolicyComponent } from "./base-policy.component";

export class HelpUsersUpdatePasswordsPolicy extends BasePolicy {
  name = "helpUsersUpdatePasswordsTitle";
  description = "helpUsersUpdatePasswordsDesc";
  listDescriptionOverride = "helpUsersUpdatePasswordsListDesc";
  type = PolicyType.HelpUsersUpdatePasswords;
  component = HelpUsersUpdatePasswordsComponent;
}

@Component({
  selector: "help-users-update-passwords",
  templateUrl: "help-users-update-passwords.component.html",
  standalone: false,
})
export class HelpUsersUpdatePasswordsComponent extends BasePolicyComponent {}
