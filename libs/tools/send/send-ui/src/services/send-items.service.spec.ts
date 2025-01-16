import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, first, Subject } from "rxjs";

import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";

import { SendItemsService } from "./send-items.service";
import { SendListFiltersService } from "./send-list-filters.service";

describe("SendItemsService", () => {
  let testBed: TestBed;
  let service: SendItemsService;

  const sendServiceMock = mock<SendService>();
  const sendListFiltersServiceMock = mock<SendListFiltersService>();
  const searchServiceMock = mock<SearchService>();

  beforeEach(() => {
    sendServiceMock.sendViews$ = new BehaviorSubject<SendView[]>([]);
    sendListFiltersServiceMock.filters$ = new BehaviorSubject({
      sendType: null,
    });
    sendListFiltersServiceMock.filterFunction$ = new BehaviorSubject((sends: SendView[]) => sends);
    searchServiceMock.searchSends.mockImplementation((sends) => sends);

    testBed = TestBed.configureTestingModule({
      providers: [
        { provide: SendService, useValue: sendServiceMock },
        { provide: SendListFiltersService, useValue: sendListFiltersServiceMock },
        { provide: SearchService, useValue: searchServiceMock },
        SendItemsService,
      ],
    });

    service = testBed.inject(SendItemsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should update and sort filteredAndSortedSends$ when filterFunction$ changes", (done) => {
    const unsortedSends = [
      { id: "2", name: "Send B", type: 2, disabled: false },
      { id: "1", name: "Send A", type: 1, disabled: false },
    ] as SendView[];

    (sendServiceMock.sendViews$ as BehaviorSubject<SendView[]>).next([...unsortedSends]);

    service.filteredAndSortedSends$.subscribe((filteredAndSortedSends) => {
      expect(filteredAndSortedSends).toEqual([unsortedSends[1], unsortedSends[0]]);
      done();
    });
  });

  it("should update loading$ when sends are loading", (done) => {
    const sendsLoading$ = new Subject<void>();
    (service as any)._sendsLoading$ = sendsLoading$;
    let sendLoadingIndex = 0;
    service.loading$.subscribe((loading) => {
      if (sendLoadingIndex === 0) {
        expect(loading).toBe(true);
        sendLoadingIndex++;
      } else {
        expect(loading).toBe(false);
        done();
      }
    });

    sendsLoading$.next();
  });

  it("should update hasFilterApplied$ when a filter is applied", (done) => {
    searchServiceMock.isSearchable.mockImplementation(async () => true);

    service.hasFilterApplied$.subscribe((canSearch) => {
      expect(canSearch).toBe(true);
      done();
    });

    service.applyFilter("test");
  });

  it("should return true for emptyList$ when there are no sends", (done) => {
    (sendServiceMock.sendViews$ as BehaviorSubject<SendView[]>).next([]);

    service.emptyList$.subscribe((empty) => {
      expect(empty).toBe(true);
      done();
    });
  });

  it("should return true for noFilteredResults$ when there are no filtered sends", (done) => {
    searchServiceMock.searchSends.mockImplementation(() => []);

    service.noFilteredResults$.pipe(first()).subscribe((noResults) => {
      expect(noResults).toBe(true);
      done();
    });

    (sendServiceMock.sendViews$ as BehaviorSubject<SendView[]>).next([]);
  });

  it("should call searchService.searchSends when applyFilter is called", (done) => {
    const searchText = "Hello";
    service.applyFilter(searchText);
    const searchServiceSpy = jest.spyOn(searchServiceMock, "searchSends");

    service.filteredAndSortedSends$.subscribe(() => {
      expect(searchServiceSpy).toHaveBeenCalledWith([], searchText);
      done();
    });
  });
});
