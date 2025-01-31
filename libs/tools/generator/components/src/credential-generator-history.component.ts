// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { BehaviorSubject, ReplaySubject, map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import {
  ColorPasswordModule,
  IconButtonModule,
  ItemModule,
  NoItemsModule,
  SectionComponent,
  SectionHeaderComponent,
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
    RouterLink,
    ItemModule,
    SectionComponent,
    SectionHeaderComponent,
    GeneratorModule,
  ],
})
export class CredentialGeneratorHistoryComponent implements OnChanges {
  protected readonly credentials$ = new BehaviorSubject<GeneratedCredential[]>([]);

  constructor(
    private generatorService: CredentialGeneratorService,
    private history: GeneratorHistoryService,
  ) {
    this.account$
      .pipe(
        switchMap((account) => this.history.credentials$(account.id)),
        map((credentials) => credentials.filter((c) => (c.credential ?? "") !== "")),
        takeUntilDestroyed(),
      )
      .subscribe(this.credentials$);
  }

  @Input({ required: true })
  account: Account;

  protected account$ = new ReplaySubject<Account>(1);

  async ngOnChanges(changes: SimpleChanges) {
    if ("account" in changes) {
      this.account$.next(this.account);
    }
  }

  protected getCopyText(credential: GeneratedCredential) {
    const info = this.generatorService.algorithm(credential.category);
    return info.copy;
  }

  protected getGeneratedValueText(credential: GeneratedCredential) {
    const info = this.generatorService.algorithm(credential.category);
    return info.credentialType;
  }
}
