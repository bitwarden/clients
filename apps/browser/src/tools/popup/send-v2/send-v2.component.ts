import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { combineLatest } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { ButtonModule, Icons, NoItemsModule } from "@bitwarden/components";
import {
  NoSendsIcon,
  NewSendDropdownComponent,
  SendListItemsContainerComponent,
  SendItemsService,
  SendSearchComponent,
  SendListFiltersComponent,
  SendListFiltersService,
} from "@bitwarden/send-ui";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

export enum SendState {
  Empty,
  NoResults,
}

@Component({
  templateUrl: "send-v2.component.html",
  standalone: true,
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    NoItemsModule,
    JslibModule,
    CommonModule,
    ButtonModule,
    RouterLink,
    NewSendDropdownComponent,
    SendListItemsContainerComponent,
    SendListFiltersComponent,
    SendSearchComponent,
  ],
})
export class SendV2Component implements OnInit, OnDestroy {
  sendType = SendType;

  sendState = SendState;

  protected listState: SendState | null = null;

  protected sends$ = this.sendItemsService.filteredAndSortedSends$;

  protected title: string = "allSends";

  protected noItemIcon = NoSendsIcon;

  protected noResultsIcon = Icons.NoResults;

  constructor(
    protected sendItemsService: SendItemsService,
    protected sendListFiltersService: SendListFiltersService,
  ) {
    combineLatest([
      this.sendItemsService.emptyList$,
      this.sendItemsService.noFilteredResults$,
      this.sendListFiltersService.filters$,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([emptyList, noFilteredResults, currentFilter]) => {
        if (currentFilter?.sendType !== null) {
          this.title = `${this.sendType[currentFilter.sendType].toLowerCase()}Sends`;
        } else {
          this.title = "allSends";
        }

        if (emptyList) {
          this.listState = SendState.Empty;
          return;
        }

        if (noFilteredResults) {
          this.listState = SendState.NoResults;
          return;
        }

        this.listState = null;
      });
  }

  ngOnInit(): void {}

  ngOnDestroy(): void {}
}
