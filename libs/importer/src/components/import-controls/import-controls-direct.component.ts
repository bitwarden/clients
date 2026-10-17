import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
} from "@angular/core";
import { FormGroup } from "@angular/forms";

import { BitSvg } from "@bitwarden/assets/svg";
import { BadgeModule, IconComponent, SvgModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { UpgradeImportType } from "../../models";

import { KeeperInlineAuthUi } from "./direct/keeper/keeper-inline-auth-ui";
import { ImportControlsKeeperCredentialsComponent } from "./import-controls-keeper-credentials.component";
import { ImportControlsKeeperLoginComponent } from "./import-controls-keeper-login.component";
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
    ImportControlsKeeperLoginComponent,
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

  /** The Keeper login prompt currently showing in place of the credential fields. */
  private readonly keeperUi = inject(KeeperInlineAuthUi);
  protected readonly keeperStage = this.keeperUi.stage;
  protected readonly keeperSubtitleKey = this.keeperUi.subtitleKey;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Back on the form after a login ends (a failure, or leaving): put focus on the Email field.
    let loginWasShowing = false;
    afterRenderEffect(() => {
      const loginShowing = this.keeperStage().kind !== "idle";
      if (loginWasShowing && !loginShowing) {
        this.host.nativeElement
          .querySelector<HTMLElement>("#importer-controls_input_keeper-email")
          ?.focus();
      }
      loginWasShowing = loginShowing;
    });
  }
}
