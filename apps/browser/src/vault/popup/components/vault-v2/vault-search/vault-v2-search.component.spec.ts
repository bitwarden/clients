import { CommonModule } from "@angular/common";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { BehaviorSubject } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SearchTextDebounceInterval } from "@bitwarden/common/vault/services/search.service";
import { SearchModule } from "@bitwarden/components";

import { VaultPopupItemsService } from "../../../services/vault-popup-items.service";
import { VaultPopupLoadingService } from "../../../services/vault-popup-loading.service";

import { VaultV2SearchComponent } from "./vault-v2-search.component";

describe("VaultV2SearchComponent", () => {
  let component: VaultV2SearchComponent;
  let fixture: ComponentFixture<VaultV2SearchComponent>;

  const searchText$ = new BehaviorSubject("");
  const loading$ = new BehaviorSubject(false);
  const applyFilter = jest.fn();

  beforeEach(async () => {
    applyFilter.mockClear();

    await TestBed.configureTestingModule({
      imports: [VaultV2SearchComponent, CommonModule, SearchModule, JslibModule, FormsModule],
      providers: [
        {
          provide: VaultPopupItemsService,
          useValue: {
            searchText$,
            applyFilter,
          },
        },
        {
          provide: VaultPopupLoadingService,
          useValue: {
            loading$,
          },
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultV2SearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("subscribes to search text from service", () => {
    searchText$.next("test search");
    fixture.detectChanges();

    expect(component.searchText).toBe("test search");
  });

  describe("debouncing behavior", () => {
    it("debounces search text changes when not loading", fakeAsync(() => {
      loading$.next(false);

      component.searchText = "test";
      component.onSearchTextChanged();

      expect(applyFilter).not.toHaveBeenCalled();

      tick(SearchTextDebounceInterval);

      expect(applyFilter).toHaveBeenCalledWith("test");
      expect(applyFilter).toHaveBeenCalledTimes(1);
    }));

    it("should not debounce search text changes when loading", fakeAsync(() => {
      loading$.next(true);

      component.searchText = "test";
      component.onSearchTextChanged();

      tick(0);

      expect(applyFilter).toHaveBeenCalledWith("test");
      expect(applyFilter).toHaveBeenCalledTimes(1);
    }));

    it("cancels previous debounce when new text is entered", fakeAsync(() => {
      loading$.next(false);

      component.searchText = "test";
      component.onSearchTextChanged();

      tick(SearchTextDebounceInterval / 2);

      component.searchText = "test2";
      component.onSearchTextChanged();

      tick(SearchTextDebounceInterval / 2);

      expect(applyFilter).not.toHaveBeenCalled();

      tick(SearchTextDebounceInterval / 2);

      expect(applyFilter).toHaveBeenCalledWith("test2");
      expect(applyFilter).toHaveBeenCalledTimes(1);
    }));
  });
});
