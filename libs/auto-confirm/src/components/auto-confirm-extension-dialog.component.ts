import { DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BadgeComponent, ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-simple-dialog dialogSize="small" hideIcon>
      <div class="tw-flex tw-flex-col tw-justify-start" bitDialogTitle>
        <div class="tw-flex tw-justify-start tw-pb-2">
          <span bitBadge variant="info"> {{ "availableNow" | i18n }}</span>
        </div>
        <div class="tw-flex tw-flex-col">
          <h3 class="tw-text-start">
            <strong>
              {{ "autoConfirmSetup" | i18n }}
            </strong>
          </h3>
          <span class="tw-overflow-y-auto tw-text-start tw-break-words tw-hyphens-auto tw-text-sm">
            {{ "autoConfirmSetupDesc" | i18n }}
          </span>
        </div>
      </div>
      <ng-container bitDialogFooter>
        <div class="tw-flex tw-flex-col tw-justify-center">
          <button
            class="tw-mb-2"
            type="button"
            bitButton
            buttonType="primary"
            (click)="dialogRef.close(true)"
          >
            {{ "turnOn" | i18n }}
          </button>
          <button
            class="tw-mb-4"
            type="button"
            bitButton
            buttonType="secondary"
            (click)="dialogRef.close(false)"
          >
            {{ "close" | i18n }}
          </button>
          <a
            class="tw-text-sm tw-text-center"
            bitLink
            href="https://bitwarden.com/help/automatic-confirmation/"
            target="_blank"
          >
            <strong class="tw-pr-1">
              {{ "autoConfirmSetupHint" | i18n }}
            </strong>
            <i class="bwi bwi-external-link bwi-fw"></i>
          </a>
        </div>
      </ng-container>
    </bit-simple-dialog>
  `,
  imports: [ButtonModule, DialogModule, CommonModule, JslibModule, BadgeComponent],
})
export class AutoConfirmExtensionSetupDialogComponent {
  constructor(public dialogRef: DialogRef<boolean>) {}

  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(AutoConfirmExtensionSetupDialogComponent);
  }
}
