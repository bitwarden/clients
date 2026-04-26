import { SearchBarService } from "./search-bar.service";

describe("SearchBarService", () => {
  let service: SearchBarService;

  beforeEach(() => {
    service = new SearchBarService();
  });

  it("returns false when no search result focus target is registered", () => {
    expect(service.focusSearchResults()).toBe(false);
  });

  it("delegates focus to the registered search result focus target", () => {
    const focusTarget = jest.fn().mockReturnValue(true);

    service.setSearchResultFocusTarget(focusTarget);

    expect(service.focusSearchResults()).toBe(true);
    expect(focusTarget).toHaveBeenCalledTimes(1);
  });

  it("clears the registered search result focus target", () => {
    service.setSearchResultFocusTarget(jest.fn().mockReturnValue(true));
    service.setSearchResultFocusTarget(null);

    expect(service.focusSearchResults()).toBe(false);
  });
});
