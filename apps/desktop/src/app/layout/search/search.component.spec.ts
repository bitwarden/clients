import { BehaviorSubject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { SearchBarService, SearchBarState } from "./search-bar.service";
import { SearchComponent } from "./search.component";

describe("SearchComponent", () => {
  let component: SearchComponent;
  let searchBarService: {
    state$: BehaviorSubject<SearchBarState>;
    setSearchText: jest.Mock;
    focusSearchResults: jest.Mock;
  };

  beforeEach(() => {
    searchBarService = {
      state$: new BehaviorSubject<SearchBarState>({ enabled: true, placeholderText: "Search" }),
      setSearchText: jest.fn(),
      focusSearchResults: jest.fn(),
    };

    component = new SearchComponent(
      searchBarService as unknown as SearchBarService,
      {
        activeAccount$: of(null),
      } as AccountService,
    );
  });

  it("moves focus to search results on forward Tab when a search is present", () => {
    const preventDefault = jest.fn();
    const event = { shiftKey: false, preventDefault } as unknown as KeyboardEvent;
    searchBarService.focusSearchResults.mockReturnValue(true);
    component.searchText.setValue("Alpha");

    component.focusSearchResults(event);

    expect(searchBarService.focusSearchResults).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it("does not prevent normal tabbing when no result target accepts focus", () => {
    const preventDefault = jest.fn();
    const event = { shiftKey: false, preventDefault } as unknown as KeyboardEvent;
    searchBarService.focusSearchResults.mockReturnValue(false);
    component.searchText.setValue("Alpha");

    component.focusSearchResults(event);

    expect(searchBarService.focusSearchResults).toHaveBeenCalledTimes(1);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("preserves Shift+Tab behavior", () => {
    const preventDefault = jest.fn();
    const event = { shiftKey: true, preventDefault } as unknown as KeyboardEvent;
    component.searchText.setValue("Alpha");

    component.focusSearchResults(event);

    expect(searchBarService.focusSearchResults).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("preserves normal tabbing when the search is empty", () => {
    const preventDefault = jest.fn();
    const event = { shiftKey: false, preventDefault } as unknown as KeyboardEvent;
    component.searchText.setValue("");

    component.focusSearchResults(event);

    expect(searchBarService.focusSearchResults).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
