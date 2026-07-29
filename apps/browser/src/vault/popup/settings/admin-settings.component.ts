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
import {
  AutoConfirmWarningDialogComponent,
  AutomaticUserConfirmationService,
} from "@bitwarden/auto-confirm/angular";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { InternalOrganizationServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import {
  CardComponent,
  DialogService,
  FormFieldModule,
  SwitchComponent,
  CalloutModule,
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
    I18nPipe,
    CalloutModule,
  ],
})
export class AdminSettingsComponent implements OnInit {
  private readonly userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(getUserId);
  private readonly organizations$: Observable<Organization[]> = this.userId$.pipe(
    switchMap((userId) => this.organizationService.organizations$(userId)),
  );

  protected readonly formLoading: WritableSignal<boolean> = signal(true);
  protected readonly adminForm = this.formBuilder.group({
    autoConfirm: false,
  });
  protected readonly showAutoConfirmSpotlight$: Observable<boolean> = this.userId$.pipe(
    switchMap((userId) =>
      this.nudgesService.showNudgeSpotlight$(NudgeType.AutoConfirmNudge, userId),
    ),
  );

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly accountService: AccountService,
    private readonly autoConfirmService: AutomaticUserConfirmationService,
    private readonly destroyRef: DestroyRef,
    private readonly dialogService: DialogService,
    private readonly nudgesService: NudgesService,
    private readonly eventCollectionService: EventCollectionService,
    private readonly organizationService: InternalOrganizationServiceAbstraction,
  ) {}

  async ngOnInit() {
    const userId = await firstValueFrom(this.userId$);
    const autoConfirmEnabled = (
      await firstValueFrom(this.autoConfirmService.configuration$(userId))
    ).enabled;
    this.adminForm.setValue({ autoConfirm: autoConfirmEnabled }, { emitEvent: false });

    this.formLoading.set(false);

    // Update State
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

    // Event Logging
    this.autoConfirmService
      .configuration$(userId)
      .pipe(
        map((state) =>
          state.enabled
            ? EventType.Organization_AutoConfirmEnabled_Admin
            : EventType.Organization_AutoConfirmDisabled_Admin,
        ),
        withLatestFrom(this.organizations$.pipe(map((organizations) => organizations[0]))),
        switchMap(([event, organization]) => {
          if (!organization) {
            return of(undefined);
          }
          return this.eventCollectionService.collect(event, undefined, true, organization.id);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    // Fire confirm on initial event
    this.autoConfirmService
      .configuration$(userId)
      .pipe(
        switchMap((state) =>
          state.enabled ? this.autoConfirmService.bulkAutoConfirmPendingUsers(userId) : of(),
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
