// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { BehaviorSubject, distinctUntilChanged, map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
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
export class CredentialGeneratorHistoryComponent {
  protected readonly userId$ = new BehaviorSubject<UserId>(null);
  protected readonly credentials$ = new BehaviorSubject<GeneratedCredential[]>([]);

  constructor(
    private accountService: AccountService,
    private generatorService: CredentialGeneratorService,
    private history: GeneratorHistoryService,
  ) {
    this.accountService.activeAccount$
      .pipe(
        takeUntilDestroyed(),
        map(({ id }) => id),
        distinctUntilChanged(),
      )
      .subscribe(this.userId$);

    this.userId$
      .pipe(
        takeUntilDestroyed(),
        switchMap((id) => id && this.history.credentials$(id)),
        map((credentials) => credentials.filter((c) => (c.credential ?? "") !== "")),
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
}
