import { TestBed } from "@angular/core/testing";
import { firstValueFrom, NEVER, of, skip, Subject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { VaultCopyButtonsService } from "@bitwarden/vault";

import { VaultPopupItemsService } from "./vault-popup-items.service";
import { VaultPopupListFiltersService } from "./vault-popup-list-filters.service";
import { VaultPopupListTableFiltersService } from "./vault-popup-list-table-filters.service";
import { VaultPopupLoadingService } from "./vault-popup-loading.service";

describe("VaultPopupLoadingService", () => {
  let service: VaultPopupLoadingService;
  let itemsLoading$: Subject<boolean>;
  let organizations$: Subject<any>;
  let collections$: Subject<any>;
  let folders$: Subject<any>;
  let showQuickCopyActions$: Subject<boolean>;

  beforeEach(() => {
    itemsLoading$ = new Subject<boolean>();
    organizations$ = new Subject<any>();
    collections$ = new Subject<any>();
    folders$ = new Subject<any>();
    showQuickCopyActions$ = new Subject<boolean>();

    TestBed.configureTestingModule({
      providers: [
        VaultPopupLoadingService,
        { provide: VaultPopupItemsService, useValue: { loading$: itemsLoading$ } },
        { provide: VaultPopupListFiltersService, useValue: { allFilters$: NEVER } },
        {
          provide: VaultPopupListTableFiltersService,
          useValue: { organizations$, collections$, folders$ },
        },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
        {
          provide: VaultCopyButtonsService,
          useValue: { showQuickCopyActions$: showQuickCopyActions$ },
        },
      ],
    });

    service = TestBed.inject(VaultPopupLoadingService);
  });

  /** Emits on all filter and copy-actions streams so the outer combineLatest unblocks. */
  const unblockFilters = (loading = false) => {
    itemsLoading$.next(loading);
    organizations$.next([]);
    collections$.next([]);
    folders$.next([]);
    showQuickCopyActions$.next(true);
  };

  it("emits true initially", async () => {
    const loading = await firstValueFrom(service.loading$);

    expect(loading).toBe(true);
  });

  it("emits false when items are loaded and filters are available", async () => {
    const loadingPromise = firstValueFrom(service.loading$.pipe(skip(1)));

    unblockFilters(false);

    expect(await loadingPromise).toBe(false);
  });

  it("emits true when items are loading", async () => {
    const loadingPromise = firstValueFrom(service.loading$.pipe(skip(2)));

    unblockFilters(false);
    itemsLoading$.next(true);

    expect(await loadingPromise).toBe(true);
  });
});
