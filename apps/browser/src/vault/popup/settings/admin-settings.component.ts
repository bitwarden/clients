import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  signal,
  WritableSignal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom, map, Observable, of, switchMap, tap, withLatestFrom } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { SpotlightComponent } from "@bitwarden/angular/vault/components/spotlight/spotlight.component";
import {
  AutoConfirmWarningDialogComponent,
  AutomaticUserConfirmationService,
} from "@bitwarden/auto-confirm";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  BitIconButtonComponent,
  CardComponent,
  DialogService,
  FormFieldModule,
  SwitchComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { UserId } from "@bitwarden/user-core";

@Component({
  templateUrl: "./admin-settings.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    FormFieldModule,
    ReactiveFormsModule,
    SwitchComponent,
    CardComponent,
    SpotlightComponent,
    BitIconButtonComponent,
    I18nPipe,
  ],
})
export class AdminSettingsComponent implements OnInit {
  private userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);

  protected readonly formLoading: WritableSignal<boolean> = signal(true);
  protected adminForm = this.formBuilder.group({
    autoConfirm: false,
  });
  protected showAutoConfirmSpotlight$: Observable<boolean> = this.userId$.pipe(
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
    const userId = await firstValueFrom(this.userId$);
    const autoConfirmEnabled = (
      await firstValueFrom(this.autoConfirmService.configuration$(userId))
    ).enabled;
    this.adminForm.setValue({ autoConfirm: autoConfirmEnabled });

    this.formLoading.set(false);

    this.adminForm.controls.autoConfirm.valueChanges
      .pipe(
        switchMap((newValue) => {
          if (newValue) {
            return this.confirm();
          }
          return of(false);
        }),
        withLatestFrom(this.autoConfirmService.configuration$(userId)),
        switchMap(([newValue, existingState]) =>
          this.autoConfirmService.upsert(userId, {
            ...existingState,
            enabled: newValue,
            showBrowserNotification: false,
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private confirm(): Observable<boolean> {
    return AutoConfirmWarningDialogComponent.open(this.dialogService).closed.pipe(
      map((result) => result ?? false),
      tap((result) => {
        if (!result) {
          this.adminForm.setValue({ autoConfirm: false }, { emitEvent: false });
        }
      }),
    );
  }

  async dismissSpotlight() {
    const userId = await firstValueFrom(this.userId$);
    const state = await firstValueFrom(this.autoConfirmService.configuration$(userId));

    await this.autoConfirmService.upsert(userId, { ...state, showBrowserNotification: false });
  }
}
