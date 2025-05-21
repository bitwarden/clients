// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, SimpleChanges, OnInit, OnDestroy } from "@angular/core";
import { BehaviorSubject, ReplaySubject, Subject, map, switchMap, takeUntil, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  SemanticLogger,
  disabledSemanticLoggerProvider,
  ifEnabledSemanticLoggerProvider,
} from "@bitwarden/common/tools/log";
import { UserId } from "@bitwarden/common/types/guid";
import {
  ColorPasswordModule,
  IconButtonModule,
  ItemModule,
  NoItemsModule,
} from "@bitwarden/components";
import { CredentialGeneratorService } from "@bitwarden/generator-core";
import { GeneratedCredential, GeneratorHistoryService } from "@bitwarden/generator-history";

import { GeneratorModule } from "./generator.module";

@Component({
  standalone: true,
  selector: "bit-credential-generator-history",
  templateUrl: "credential-generator-history.component.html",
  imports: [
    ColorPasswordModule,
    CommonModule,
    IconButtonModule,
    NoItemsModule,
    JslibModule,
    ItemModule,
    GeneratorModule,
  ],
})
export class CredentialGeneratorHistoryComponent implements OnChanges, OnInit, OnDestroy {
  private readonly destroyed = new Subject<void>();
  protected readonly credentials$ = new BehaviorSubject<GeneratedCredential[]>([]);

  constructor(
    private generatorService: CredentialGeneratorService,
    private history: GeneratorHistoryService,
    private logService: LogService,
  ) {}

  @Input({ required: true })
  account: Account;

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

  ngOnInit() {
    this.log = ifEnabledSemanticLoggerProvider(this.debug, this.logService, {
      type: "CredentialGeneratorComponent",
    });

    this.account$
      .pipe(
        tap((account) => this.log.info({ accountId: account.id }, "loading credential history")),
        switchMap((account) => this.history.credentials$(account.id)),
        map((credentials) => credentials.filter((c) => (c.credential ?? "") !== "")),
        takeUntil(this.destroyed),
      )
      .subscribe(this.credentials$);
  }

  protected getCopyText(credential: GeneratedCredential) {
    const info = this.generatorService.algorithm(credential.category);
    return info.copy;
  }

  protected getGeneratedValueText(credential: GeneratedCredential) {
    const info = this.generatorService.algorithm(credential.category);
    return info.credentialType;
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();

    this.log.debug("component destroyed");
  }
}
