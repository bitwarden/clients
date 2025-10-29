// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnChanges } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { Unassigned } from "@bitwarden/admin-console/common";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/sdk-internal";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-org-badge",
  templateUrl: "organization-name-badge.component.html",
  standalone: false,
})
export class OrganizationNameBadgeComponent implements OnChanges {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() organizationId?: OrganizationId | string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() organizationName: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disabled: boolean;

  // Need a separate variable or we get weird behavior when used as part of cdk virtual scrolling
  name: string;
  color: string;
  textColor: string;
  isMe: boolean;

  constructor(
    private i18nService: I18nService,
    private avatarService: AvatarService,
    private tokenService: TokenService,
  ) {}

  // ngOnChanges is required since this component might be reused as part of
  // cdk virtual scrolling
  async ngOnChanges() {
    this.isMe = this.organizationName == null || this.organizationName === "";

    if (this.isMe) {
      this.name = this.i18nService.t("me");
      this.color = await firstValueFrom(this.avatarService.avatarColor$);
      if (this.color == null) {
        const userId = await this.tokenService.getUserId();
        if (userId != null) {
          this.color = Utils.stringToColor(userId);
        } else {
          const userName =
            (await this.tokenService.getName()) ?? (await this.tokenService.getEmail());
          this.color = Utils.stringToColor(userName.toUpperCase());
        }
      }
    } else {
      this.name = this.organizationName;
      this.color = Utils.stringToColor(this.organizationName.toUpperCase());
    }
    this.textColor = Utils.pickTextColorBasedOnBgColor(this.color, 135, true) + "!important";
  }

  get organizationIdLink() {
    return this.organizationId ?? Unassigned;
  }
}
