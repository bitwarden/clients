import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { FormGroup } from "@angular/forms";

import { BitSvg } from "@bitwarden/assets/svg";
import { BadgeModule, IconComponent, SvgModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { UpgradeImportType } from "../../models";

import { ImportControlsKeeperCredentialsComponent } from "./import-controls-keeper-credentials.component";
import { ImportControlsLastPassCredentialsComponent } from "./import-controls-lastpass-credentials.component";

/** The current phase of a direct importer flow */
export type DirectStep = "intro" | "credentials";

@Component({
  selector: "importer-controls-direct",
  templateUrl: "./import-controls-direct.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeModule,
    I18nPipe,
    IconComponent,
    ImportControlsKeeperCredentialsComponent,
    ImportControlsLastPassCredentialsComponent,
    SvgModule,
    TypographyModule,
  ],
  host: { class: "tw-contents" },
})
export class ImportControlsDirectComponent {
  /** The parent's form, passed to the vendor's credential fields. */
  readonly form = input.required<FormGroup>();
  readonly step = input.required<DirectStep>();
  readonly importType = input.required<UpgradeImportType>();
  readonly vendorName = input.required<string>();
  readonly vendorIcon = input<BitSvg>();
}
