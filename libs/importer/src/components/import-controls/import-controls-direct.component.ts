import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from "@angular/core";
import { FormGroup } from "@angular/forms";

import { BitSvg } from "@bitwarden/assets/svg";
import { BadgeModule, IconTileComponent, SvgModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { UpgradeImportType } from "../../models";

import { KeeperInlineAuthUi } from "./direct/keeper/keeper-inline-auth-ui";
import { LastPassInlineAuthUi } from "./direct/lastpass/lastpass-inline-auth-ui";
import { ImportControlsKeeperCredentialsComponent } from "./import-controls-keeper-credentials.component";
import { ImportControlsKeeperLoginComponent } from "./import-controls-keeper-login.component";
import { ImportControlsLastPassCredentialsComponent } from "./import-controls-lastpass-credentials.component";
import { ImportControlsLastPassLoginComponent } from "./import-controls-lastpass-login.component";

/** The current phase of a direct importer flow */
export type DirectStep = "intro" | "credentials";

@Component({
  selector: "importer-controls-direct",
  templateUrl: "./import-controls-direct.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeModule,
    I18nPipe,
    IconTileComponent,
    ImportControlsKeeperCredentialsComponent,
    ImportControlsKeeperLoginComponent,
    ImportControlsLastPassCredentialsComponent,
    ImportControlsLastPassLoginComponent,
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
  readonly isLastPass = input.required<boolean>();
  readonly vendorName = input.required<string>();
  readonly vendorIcon = input<BitSvg>();

  /** The Keeper login prompt currently showing in place of the credential fields. */
  private readonly keeperUi = inject(KeeperInlineAuthUi);
  protected readonly keeperStage = this.keeperUi.stage;
  protected readonly keeperScreen = this.keeperUi.screen;

  /** The LastPass login prompt currently showing in place of the credential fields. */
  private readonly lastPassUi = inject(LastPassInlineAuthUi);
  protected readonly lastPassStage = this.lastPassUi.stage;
  protected readonly lastPassScreen = this.lastPassUi.screen;

  /** The card header's subtitle for the screen showing; null keeps the default one. */
  protected readonly subtitleKey = computed(() =>
    this.isLastPass() ? this.lastPassUi.subtitleKey() : this.keeperUi.subtitleKey(),
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Back on the form after a login ends (a failure, or leaving): put focus on the Email field.
    let loginWasShowing = false;
    afterRenderEffect(() => {
      const loginShowing =
        this.keeperStage().kind !== "idle" || this.lastPassStage().kind !== "idle";
      if (loginWasShowing && !loginShowing) {
        const emailId = this.isLastPass()
          ? "#importer-controls_input_lastpass-email"
          : "#importer-controls_input_keeper-email";
        this.host.nativeElement.querySelector<HTMLElement>(emailId)?.focus();
      }
      loginWasShowing = loginShowing;
    });
  }
}
