// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { UntypedFormControl } from "@angular/forms";
import { Subscription } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { SearchBarService, SearchBarState } from "./search-bar.service";

@Component({
  selector: "app-search",
  templateUrl: "search.component.html",
})
export class SearchComponent implements OnInit, OnDestroy {
  state: SearchBarState;
  searchText: UntypedFormControl = new UntypedFormControl(null);

  private activeAccountSubscription: Subscription;

  constructor(
    private searchBarService: SearchBarService,
    private accountService: AccountService,
  ) {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.searchBarService.state$.subscribe((state) => {
      this.state = state;
    });

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.searchText.valueChanges.subscribe((value) => {
      this.searchBarService.setSearchText(value);
    });
  }

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.activeAccountSubscription = this.accountService.activeAccount$.subscribe((_) => {
      this.searchBarService.setSearchText("");
      this.searchText.patchValue("");
    });
  }

  ngOnDestroy() {
    this.activeAccountSubscription.unsubscribe();
  }
}
