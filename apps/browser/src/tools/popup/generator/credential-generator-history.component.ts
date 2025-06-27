// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, SimpleChanges, OnInit, OnDestroy } from "@angular/core";
import { ReplaySubject, Subject, firstValueFrom, map, switchMap, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  SemanticLogger,
  disabledSemanticLoggerProvider,
  ifEnabledSemanticLoggerProvider,
} from "@bitwarden/common/tools/log";
import { UserId } from "@bitwarden/common/types/guid";
import { ButtonModule, DialogService } from "@bitwarden/components";
import {
  CredentialGeneratorHistoryComponent as CredentialGeneratorHistoryToolsComponent,
  EmptyCredentialHistoryComponent,
} from "@bitwarden/generator-components";
import { GeneratorHistoryService } from "@bitwarden/generator-history";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  selector: "app-credential-generator-history",
  templateUrl: "credential-generator-history.component.html",
  imports: [
    ButtonModule,
    CommonModule,
    JslibModule,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    CredentialGeneratorHistoryToolsComponent,
    EmptyCredentialHistoryComponent,
    PopupFooterComponent,
  ],
})
export class CredentialGeneratorHistoryComponent implements OnChanges, OnInit, OnDestroy {
  private readonly destroyed = new Subject<void>();
  protected readonly hasHistory$ = new ReplaySubject<boolean>(1);
  protected readonly account$ = new ReplaySubject<Account>(1);

  constructor(
    private accountService: AccountService,
    private history: GeneratorHistoryService,
    private dialogService: DialogService,
    private logService: LogService,
  ) {}

  @Input()
  account: Account | null;

  /** Send structured debug logs from the credential generator component
   *  to the debugger console.
   *
   *  @warning this may reveal sensitive information in plaintext.
   */
  @Input()
  debug: boolean = false;

  // this `log` initializer is overridden in `ngOnInit`
  private log: SemanticLogger = disabledSemanticLoggerProvider({});

  async ngOnChanges(changes: SimpleChanges) {
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

  clear = async () => {
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
  };

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();

    this.log.debug("component destroyed");
  }
}
