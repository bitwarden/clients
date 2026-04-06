// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Component for the Danger Zone section of the Account/Organization Settings page.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-danger-zone",
  templateUrl: "danger-zone.component.html",
  imports: [CommonModule, TypographyModule, I18nPipe],
})
export class DangerZoneComponent {}
