// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Component for the Danger Zone section of the Account/Organization Settings page.
 */
@Component({
  selector: "app-danger-zone",
  templateUrl: "danger-zone.component.html",
  imports: [CommonModule, TypographyModule, I18nPipe],
})
export class DangerZoneComponent {}
