import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { GatedCollectionFilterIndicatorComponent } from "./gated-collection-filter-indicator.component";

describe("GatedCollectionFilterIndicatorComponent", () => {
  let fixture: ComponentFixture<GatedCollectionFilterIndicatorComponent>;
  let enabled$: BehaviorSubject<boolean>;

  function create(collection: { hasEnabledAccessRule?: boolean } | null): void {
    fixture = TestBed.createComponent(GatedCollectionFilterIndicatorComponent);
    fixture.componentRef.setInput("collection", collection);
    fixture.detectChanges();
  }

  function lock(): HTMLElement | null {
    return fixture.nativeElement.querySelector("[data-testid='vault-filter-gated-collection']");
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);

    TestBed.configureTestingModule({
      imports: [GatedCollectionFilterIndicatorComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        {
          provide: I18nService,
          useValue: { t: (key: string) => key },
        },
      ],
    });
  });

  it("marks a collection governed by an enabled rule", () => {
    create({ hasEnabledAccessRule: true });

    expect(lock()).not.toBeNull();
  });

  it("names the restriction for assistive technology as well as on hover", () => {
    create({ hasEnabledAccessRule: true });

    expect(lock()?.getAttribute("role")).toBe("img");
    expect(lock()?.getAttribute("aria-label")).toBe("pamCollectionRequiresRequest");
    expect(lock()?.getAttribute("title")).toBe("pamCollectionRequiresRequest");
  });

  it("keeps the muted styling alongside the icon's own classes", () => {
    create({ hasEnabledAccessRule: true });

    expect(lock()?.classList).toContain("tw-text-muted");
    expect(lock()?.classList).toContain("bwi-lock-encrypted");
  });

  it("leaves a collection no enabled rule governs unmarked", () => {
    create({ hasEnabledAccessRule: false });

    expect(lock()).toBeNull();
  });

  it("leaves a pseudo-collection with no server state unmarked", () => {
    create({});

    expect(lock()).toBeNull();
  });

  it("leaves a null collection unmarked", () => {
    create(null);

    expect(lock()).toBeNull();
  });

  it("does not mark a governed collection when the PAM flag is off", () => {
    enabled$.next(false);

    create({ hasEnabledAccessRule: true });

    expect(lock()).toBeNull();
  });
});
