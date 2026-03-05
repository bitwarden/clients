import { TestBed } from "@angular/core/testing";
import { firstValueFrom, skip, Subject } from "rxjs";

import { VaultPopupCopyButtonsService } from "./vault-popup-copy-buttons.service";
import { VaultPopupItemsService } from "./vault-popup-items.service";
import { VaultPopupListFiltersService } from "./vault-popup-list-filters.service";
import { VaultPopupLoadingService } from "./vault-popup-loading.service";

describe("VaultPopupLoadingService", () => {
  let service: VaultPopupLoadingService;
  let itemsLoading$: Subject<boolean>;
  let allFilters$: Subject<any>;
  let showQuickCopyActions$: Subject<boolean>;

  beforeEach(() => {
    itemsLoading$ = new Subject<boolean>();
    allFilters$ = new Subject<any>();
    showQuickCopyActions$ = new Subject<boolean>();

    TestBed.configureTestingModule({
      providers: [
        VaultPopupLoadingService,
        { provide: VaultPopupItemsService, useValue: { loading$: itemsLoading$ } },
        { provide: VaultPopupListFiltersService, useValue: { allFilters$: allFilters$ } },
        {
          provide: VaultPopupCopyButtonsService,
          useValue: { showQuickCopyActions$: showQuickCopyActions$ },
        },
      ],
    });

    service = TestBed.inject(VaultPopupLoadingService);
  });

  it("emits true initially", async () => {
    const loading = await firstValueFrom(service.loading$);

    expect(loading).toBe(true);
  });

  it("emits false when items are loaded and filters are available", async () => {
    const loadingPromise = firstValueFrom(service.loading$.pipe(skip(1)));

    itemsLoading$.next(false);
    allFilters$.next({});
    showQuickCopyActions$.next(true);

    expect(await loadingPromise).toBe(false);
  });

  it("emits true when filters are not available", async () => {
    const loadingPromise = firstValueFrom(service.loading$.pipe(skip(2)));

    itemsLoading$.next(false);
    allFilters$.next({});
    showQuickCopyActions$.next(true);
    allFilters$.next(null);

    expect(await loadingPromise).toBe(true);
  });

  it("emits true when items are loading", async () => {
    const loadingPromise = firstValueFrom(service.loading$.pipe(skip(2)));

    itemsLoading$.next(false);
    allFilters$.next({});
    showQuickCopyActions$.next(true);
    itemsLoading$.next(true);

    expect(await loadingPromise).toBe(true);
  });
});
