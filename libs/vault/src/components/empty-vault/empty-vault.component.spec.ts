import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { EmptyVaultComponent } from "./empty-vault.component";

describe("EmptyVaultComponent", () => {
  let fixture: ComponentFixture<EmptyVaultComponent>;
  let component: EmptyVaultComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyVaultComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyVaultComponent);
    component = fixture.componentInstance;

    // Required inputs — set defaults before the first detectChanges.
    fixture.componentRef.setInput("hasItems", false);
    fixture.componentRef.setInput("hasActiveFilters", false);
    fixture.detectChanges();
  });

  /** The projected "Clear all" button, identified by its slot attribute. */
  function clearAllButton(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('button[slot="button"]')).nativeElement;
  }

  describe("title", () => {
    it("shows the empty-vault title when the vault has no items at all", () => {
      fixture.componentRef.setInput("hasItems", false);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("noItemsInVault");
    });

    it("shows the no-matching-items title when items exist but are all filtered out", () => {
      fixture.componentRef.setInput("hasItems", true);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("noMatchingItems");
    });
  });

  describe("description", () => {
    it("shows the empty-vault description when the vault has no items at all", () => {
      fixture.componentRef.setInput("hasItems", false);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("emptyVaultDescription");
    });

    it("shows the filter-hint description when items exist but are all filtered out", () => {
      fixture.componentRef.setInput("hasItems", true);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("clearFiltersOrTryAnother");
    });
  });

  describe("Clear all button", () => {
    it("is hidden when no chip filters are active", () => {
      fixture.componentRef.setInput("hasActiveFilters", false);
      fixture.detectChanges();

      expect(clearAllButton().classList).toContain("tw-hidden");
    });

    it("is visible when at least one chip filter is active", () => {
      fixture.componentRef.setInput("hasActiveFilters", true);
      fixture.detectChanges();

      expect(clearAllButton().classList).not.toContain("tw-hidden");
    });

    it("emits clearFilters when clicked", () => {
      fixture.componentRef.setInput("hasActiveFilters", true);
      fixture.detectChanges();

      jest.spyOn(component.clearFilters, "emit");
      clearAllButton().click();

      expect(component.clearFilters.emit).toHaveBeenCalledTimes(1);
    });
  });
});
