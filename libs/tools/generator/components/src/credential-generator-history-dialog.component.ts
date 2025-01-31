// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, ReplaySubject, firstValueFrom, map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ButtonModule, DialogModule, DialogService } from "@bitwarden/components";
import { GeneratorHistoryService } from "@bitwarden/generator-history";

import { CredentialGeneratorHistoryComponent as CredentialGeneratorHistoryToolsComponent } from "./credential-generator-history.component";
import { EmptyCredentialHistoryComponent } from "./empty-credential-history.component";

@Component({
  templateUrl: "credential-generator-history-dialog.component.html",
  standalone: true,
  imports: [
    ButtonModule,
    CommonModule,
    JslibModule,
    DialogModule,
    CredentialGeneratorHistoryToolsComponent,
    EmptyCredentialHistoryComponent,
  ],
})
export class CredentialGeneratorHistoryDialogComponent implements OnChanges {
  protected readonly hasHistory$ = new BehaviorSubject<boolean>(false);

  constructor(
    private accountService: AccountService,
    private history: GeneratorHistoryService,
    private dialogService: DialogService,
    private dialogRef: DialogRef,
  ) {
    this.account$
      .pipe(
        switchMap((account) => account.id && this.history.credentials$(account.id)),
        map((credentials) => credentials.length > 0),
        takeUntilDestroyed(),
      )
      .subscribe(this.hasHistory$);
  }

  @Input()
  account: Account | null;

  protected account$ = new ReplaySubject<Account>(1);

  async ngOnChanges(changes: SimpleChanges) {
    if ("account" in changes && changes.account) {
      this.account$.next(this.account);
    } else if (!changes.account) {
      const account = await firstValueFrom(this.accountService.activeAccount$);
      this.account$.next(account);
    }
  }

  /** closes the dialog */
  protected close() {
    this.dialogRef.close();
  }

  /** Launches clear history flow */
  protected async clear() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "clearGeneratorHistoryTitle" },
      content: { key: "cleargGeneratorHistoryDescription" },
      type: "warning",
      acceptButtonText: { key: "clearHistory" },
      cancelButtonText: { key: "cancel" },
    });

    if (confirmed) {
      await this.history.clear((await firstValueFrom(this.account$)).id);
    }
  }
}
