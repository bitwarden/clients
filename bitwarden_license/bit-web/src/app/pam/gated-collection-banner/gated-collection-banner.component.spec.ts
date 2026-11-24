import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { GatedCollectionBannerComponent } from "./gated-collection-banner.component";

describe("GatedCollectionBannerComponent", () => {
  let fixture: ComponentFixture<GatedCollectionBannerComponent>;
  let enabled$: BehaviorSubject<boolean>;

  function create(collection: { hasEnabledAccessRule?: boolean } | null | undefined): void {
    fixture = TestBed.createComponent(GatedCollectionBannerComponent);
    fixture.componentRef.setInput("collection", collection);
    fixture.detectChanges();
  }

  function banner(): HTMLElement | null {
    return fixture.nativeElement.querySelector("[data-testid='pam-gated-collection-banner']");
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);

    TestBed.configureTestingModule({
      imports: [GatedCollectionBannerComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    });
  });

  it("explains the restriction on a collection governed by an enabled rule", () => {
    create({ hasEnabledAccessRule: true });

    expect(banner()).not.toBeNull();
    expect(banner()?.textContent).toContain("pamSharedFolderRequiresRequest");
  });

  it("names the notice's landmark with a label distinct from the sentence it displays", () => {
    create({ hasEnabledAccessRule: true });

    expect(banner()?.querySelector("aside")?.getAttribute("aria-label")).toBe(
      "pamGatedCollectionBannerName",
    );
  });

  it("offers no dismiss control, so the explanation cannot be hidden while the collection is open", () => {
    create({ hasEnabledAccessRule: true });

    expect(banner()?.querySelector("button")).toBeNull();
  });

  it("stays hidden when no enabled rule governs the collection", () => {
    create({ hasEnabledAccessRule: false });

    expect(banner()).toBeNull();
  });

  it("stays hidden when no single collection is the active filter", () => {
    create(undefined);

    expect(banner()).toBeNull();
  });

  // `NgComponentOutlet` reuses one banner instance and swaps its inputs.
  it("follows the collection when the host swaps it", () => {
    create({ hasEnabledAccessRule: true });
    expect(banner()).not.toBeNull();

    fixture.componentRef.setInput("collection", { hasEnabledAccessRule: false });
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });

  it("stays hidden when the PAM flag is off", () => {
    enabled$.next(false);

    create({ hasEnabledAccessRule: true });

    expect(banner()).toBeNull();
  });
});
