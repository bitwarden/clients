import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

export type SearchBarState = {
  enabled: boolean;
  placeholderText: string;
};

type SearchResultFocusTarget = () => boolean;

@Injectable()
export class SearchBarService {
  private searchTextSubject = new BehaviorSubject<string | null>(null);
  searchText$ = this.searchTextSubject.asObservable();

  private searchResultFocusTarget: SearchResultFocusTarget | null = null;

  private _state = {
    enabled: false,
    placeholderText: "",
  };

  private stateSubject = new BehaviorSubject<SearchBarState>(this._state);
  state$ = this.stateSubject.asObservable();

  setEnabled(enabled: boolean) {
    this._state.enabled = enabled;
    this.updateState();
  }

  setPlaceholderText(placeholderText: string) {
    this._state.placeholderText = placeholderText;
    this.updateState();
  }

  setSearchText(value: string) {
    this.searchTextSubject.next(value);
  }

  setSearchResultFocusTarget(target: SearchResultFocusTarget | null) {
    this.searchResultFocusTarget = target;
  }

  focusSearchResults() {
    return this.searchResultFocusTarget?.() ?? false;
  }

  private updateState() {
    this.stateSubject.next(this._state);
  }
}
