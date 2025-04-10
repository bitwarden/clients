// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, SimpleChanges, OnInit, OnDestroy } from "@angular/core";
import {
  BehaviorSubject,
  ReplaySubject,
  Subject,
  firstValueFrom,
  map,
  switchMap,
  takeUntil,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  SemanticLogger,
  disabledSemanticLoggerProvider,
  ifEnabledSemanticLoggerProvider,
} from "@bitwarden/common/tools/log";
import { UserId } from "@bitwarden/common/types/guid";
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
export class CredentialGeneratorHistoryDialogComponent implements OnChanges, OnInit, OnDestroy {
  private readonly destroyed = new Subject<void>();
  protected readonly hasHistory$ = new BehaviorSubject<boolean>(false);

  constructor(
    private accountService: AccountService,
    private history: GeneratorHistoryService,
    private dialogService: DialogService,
    private logService: LogService,
  ) {}

  @Input()
  account: Account | null;

  protected account$ = new ReplaySubject<Account>(1);

  /** Send structured debug logs from the credential generator component
   *  to the debugger console.
   *
   *  @warning this may reveal sensitive information in plaintext.
   */
  @Input()
  debug: boolean = false;

  // this `log` initializer is overridden in `ngOnInit`
  private log: SemanticLogger = disabledSemanticLoggerProvider({});

  ngOnChanges(changes: SimpleChanges) {
    const account = changes?.account;
    if (account?.previousValue?.id !== account?.currentValue?.id) {
      this.log.debug(
        {
          previousUserId: account?.previousValue?.id as UserId,
          currentUserId: account?.currentValue?.id as UserId,
        },
        "account input change detected",
      );
      this.account$.next(account.currentValue ?? this.account);
    }
  }

  async ngOnInit() {
    this.log = ifEnabledSemanticLoggerProvider(this.debug, this.logService, {
      type: "CredentialGeneratorComponent",
    });

    if (!this.account) {
      this.account = await firstValueFrom(this.accountService.activeAccount$);
      this.log.info(
        { userId: this.account.id },
        "account not specified; using active account settings",
      );
      this.account$.next(this.account);
    }

    this.account$
      .pipe(
        switchMap((account) => account.id && this.history.credentials$(account.id)),
        map((credentials) => credentials.length > 0),
        takeUntil(this.destroyed),
      )
      .subscribe(this.hasHistory$);
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

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();

    this.log.debug("component destroyed");
  }
}
