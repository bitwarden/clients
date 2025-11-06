import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom, lastValueFrom, Observable, switchMap, withLatestFrom } from "rxjs";

import {
  AutoConfirmState,
  AutomaticUserConfirmationService,
} from "@bitwarden/admin-console/common";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { SpotlightComponent } from "@bitwarden/angular/vault/components/spotlight/spotlight.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  ButtonModule,
  CardComponent,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  SwitchModule,
} from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";

@Component({
  templateUrl: "./admin-settings.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    FormFieldModule,
    ReactiveFormsModule,
    SwitchModule,
    CardComponent,
    SpotlightComponent,
  ],
})
export class AdminSettingsComponent implements OnInit {
  private userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);
  private autoConfirmState$: Observable<AutoConfirmState> = this.userId$.pipe(
    switchMap((userId) => this.autoConfirmService.configuration$(userId)),
  );

  protected formLoading = true;
  protected adminForm: FormGroup = this.formBuilder.group({
    autoConfirm: false,
  });

  showAutoConfirmSpotlight$: Observable<boolean> = this.userId$.pipe(
    switchMap((userId) =>
      this.nudgesService.showNudgeSpotlight$(NudgeType.AutoConfirmNudge, userId),
    ),
  );

  constructor(
    private formBuilder: FormBuilder,
    private accountService: AccountService,
    private autoConfirmService: AutomaticUserConfirmationService,
    private destroyRef: DestroyRef,
    private dialogService: DialogService,
    private nudgesService: NudgesService,
  ) {}

  async ngOnInit() {
    this.formLoading = false;

    const autoConfirmEnabled = (await firstValueFrom(this.autoConfirmState$)).enabled;
    this.adminForm.setValue({ autoConfirm: autoConfirmEnabled });

    this.adminForm.controls.autoConfirm.valueChanges
      .pipe(
        switchMap(async (newValue) => {
          if (newValue) {
            const ref = AutoConfirmWarningDialog.open(this.dialogService);
            const result = await lastValueFrom(ref.closed);

            if (result) {
              return newValue;
            }
          }
          this.adminForm.setValue({ autoConfirm: false }, { emitEvent: false });
          return false;
        }),
        withLatestFrom(this.userId$, this.autoConfirmState$),
        switchMap(([newValue, userId, existingSate]) =>
          this.autoConfirmService.upsert(userId, { ...existingSate, enabled: newValue }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  async dismissSpotlight() {
    const userId = await firstValueFrom(this.userId$);
    const state = await firstValueFrom(this.autoConfirmState$);

    await this.autoConfirmService.upsert(userId, { ...state, showBrowserNotification: false });
  }
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <bit-simple-dialog dialogSize="small">
      <span bitDialogTitle>
        <strong>{{ "warningCapitalized" | i18n }}</strong>
      </span>
      <span bitDialogContent>
        {{ "autoConfirmWarning" | i18n }}
        <a bitLink href="https://bitwarden.com/help/automatic-confirmation/" target="_blank">
          {{ "autoConfirmWarningLink" | i18n }}
          <i class="bwi bwi-external-link bwi-fw"></i>
        </a>
      </span>
      <ng-container bitDialogFooter>
        <button type="button" bitButton buttonType="primary" (click)="dialogRef.close(true)">
          {{ "turnOn" | i18n }}
        </button>
        <button type="button" bitButton buttonType="secondary" (click)="dialogRef.close(false)">
          {{ "close" | i18n }}
        </button>
      </ng-container>
    </bit-simple-dialog>
  `,
  imports: [ButtonModule, DialogModule, CommonModule, JslibModule],
})
class AutoConfirmWarningDialog {
  constructor(public dialogRef: DialogRef<boolean>) {}

  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(AutoConfirmWarningDialog);
  }
}
