import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AutofocusDirective,
  BitwardenIcon,
  ButtonModule,
  CenterPositionStrategy,
  DialogModule,
  DialogRef,
  DialogService,
  IconTileComponent,
  TypographyModule,
} from "@bitwarden/components";

/**
 * How the welcome dialog was resolved. Closing without choosing (Esc, backdrop, the close button)
 * emits no result, which callers treat as `Dismissed`.
 */
export const PamWelcomeDialogResult = Object.freeze({
  StartTour: "start-tour",
  Dismissed: "dismissed",
} as const);

export type PamWelcomeDialogResult =
  (typeof PamWelcomeDialogResult)[keyof typeof PamWelcomeDialogResult];

type WelcomeStep = {
  icon: BitwardenIcon;
  titleKey: string;
  descriptionKey: string;
};

/**
 * One-time introduction for PAM-licensed members. It only reports the member's choice; the caller
 * starts the tour and records that the welcome was seen.
 */
@Component({
  selector: "pam-welcome-dialog",
  templateUrl: "./pam-welcome-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DialogModule,
    ButtonModule,
    TypographyModule,
    IconTileComponent,
    AutofocusDirective,
    JslibModule,
  ],
})
export class PamWelcomeDialogComponent {
  private readonly dialogRef = inject<DialogRef<PamWelcomeDialogResult>>(DialogRef);

  protected readonly steps: readonly WelcomeStep[] = [
    {
      icon: "bwi-search",
      titleKey: "pamWelcomeFindTitle",
      descriptionKey: "pamWelcomeFindDescription",
    },
    {
      icon: "bwi-key",
      titleKey: "pamWelcomeRequestTitle",
      descriptionKey: "pamWelcomeRequestDescription",
    },
    {
      icon: "bwi-clock",
      titleKey: "pamWelcomeLeaseTitle",
      descriptionKey: "pamWelcomeLeaseDescription",
    },
  ];

  protected startTour(): void {
    void this.dialogRef.close(PamWelcomeDialogResult.StartTour);
  }

  protected dismiss(): void {
    void this.dialogRef.close(PamWelcomeDialogResult.Dismissed);
  }

  /**
   * The ref's `closed` emits `undefined` when the header close button, Esc or the backdrop closes
   * the dialog; callers treat that as {@link PamWelcomeDialogResult.Dismissed}.
   */
  static open(dialogService: DialogService): DialogRef<PamWelcomeDialogResult | undefined> {
    return dialogService.open<PamWelcomeDialogResult | undefined>(PamWelcomeDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
