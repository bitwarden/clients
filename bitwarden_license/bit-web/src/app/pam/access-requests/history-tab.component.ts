import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeComponent,
  NoItemsModule,
  TableDataSource,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DurationShortPipe } from "../date/duration-short.pipe";
import { RelativeTimePipe } from "../date/relative-time.pipe";

import { MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

/**
 * "History" tab — the caller's terminal requests (everything but pending/approved, which live on
 * the My requests tab). Read-only: a history row can no longer be started, cancelled, or ended, so
 * no action column and no live clock — unlike {@link MyRequestsTabComponent}. Data and name
 * resolution come from {@link MyAccessService} (shared across tabs via the shell route).
 */
@Component({
  selector: "pam-history-tab",
  templateUrl: "./history-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    BadgeComponent,
    IconComponent,
    NoItemsModule,
    TableModule,
    TypographyModule,
    I18nPipe,
    DurationShortPipe,
    RelativeTimePipe,
  ],
})
export class HistoryTabComponent {
  private readonly myAccess = inject(MyAccessService);

  protected readonly historyRows = toSignal(this.myAccess.historyRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });

  private readonly cipherById = toSignal(this.myAccess.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  protected readonly historyDataSource = new TableDataSource<MyAccessRequestRow>();

  constructor() {
    effect(() => {
      this.historyDataSource.data = this.historyRows();
    });
  }

  /** The decrypted cipher for a row, or undefined when it isn't in the caller's vault. */
  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.cipherById().get(cipherId);
  }
}
