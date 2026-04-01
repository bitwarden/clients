import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { filter, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PreferenceSyncService } from "@bitwarden/common/platform/sync/preferences/preference-sync.service";
import { UserId } from "@bitwarden/common/types/guid";
import { FormFieldModule, SwitchComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "bit-enable-user-preferences-sync",
  templateUrl: "enable-user-preferences-sync.component.html",
  imports: [SwitchComponent, FormFieldModule, ReactiveFormsModule, I18nPipe, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
})
export class EnableUserPreferencesSyncComponent implements OnInit {
  private readonly accountService = inject(AccountService);
  private readonly preferenceSyncService = inject(PreferenceSyncService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly syncEnabledControl = new FormControl<boolean>(false, { nonNullable: true });

  async ngOnInit(): Promise<void> {
    const userId: UserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    const currentValue = await firstValueFrom(this.preferenceSyncService.syncEnabled$(userId));
    this.syncEnabledControl.setValue(currentValue, { emitEvent: false });

    this.syncEnabledControl.valueChanges
      .pipe(
        filter((value) => value != null),
        switchMap((enabled) => this.preferenceSyncService.setSyncEnabled(userId, enabled)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
