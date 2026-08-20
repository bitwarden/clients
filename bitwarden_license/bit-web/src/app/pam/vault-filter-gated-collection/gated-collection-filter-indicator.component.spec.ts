import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import type { AccessRuleView } from "../abstractions/access-rule";
import { GovernedCollectionsService } from "../services/governed-collections.service";

import { GatedCollectionFilterIndicatorComponent } from "./gated-collection-filter-indicator.component";

function accessRule(enabled: boolean, collections: string[]): AccessRuleView {
  return { enabled, collections } as unknown as AccessRuleView;
}

const PAM_ORG = "org-1";
const PLAIN_ORG = "org-2";
const COLLECTION = "collection-1";

describe("GatedCollectionFilterIndicatorComponent", () => {
  let fixture: ComponentFixture<GatedCollectionFilterIndicatorComponent>;
  let enabled$: BehaviorSubject<boolean>;
  let governedCollections: MockProxy<GovernedCollectionsService>;
  let organizations$: BehaviorSubject<{ id: string; usePam: boolean }[]>;

  function create(collection: { id?: string; organizationId?: string } | null): void {
    fixture = TestBed.createComponent(GatedCollectionFilterIndicatorComponent);
    fixture.componentRef.setInput("collection", collection);
    fixture.detectChanges();
  }

  function lock(): HTMLElement | null {
    return fixture.nativeElement.querySelector("[data-testid='vault-filter-gated-collection']");
  }

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    governedCollections = mock<GovernedCollectionsService>();
    governedCollections.rules$.mockReturnValue(of([accessRule(true, [COLLECTION])]));
    organizations$ = new BehaviorSubject<{ id: string; usePam: boolean }[]>([
      { id: PAM_ORG, usePam: true },
      { id: PLAIN_ORG, usePam: false },
    ]);

    TestBed.configureTestingModule({
      imports: [GatedCollectionFilterIndicatorComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: GovernedCollectionsService, useValue: governedCollections },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        {
          provide: I18nService,
          useValue: { t: (key: string) => key },
        },
      ],
    });
  });

  it("marks a collection governed by an enabled rule", () => {
    create({ id: COLLECTION, organizationId: PAM_ORG });

    expect(lock()).not.toBeNull();
  });

  it("names the restriction for assistive technology as well as on hover", () => {
    create({ id: COLLECTION, organizationId: PAM_ORG });

    expect(lock()?.getAttribute("role")).toBe("img");
    expect(lock()?.getAttribute("aria-label")).toBe("pamCollectionRequiresRequest");
    expect(lock()?.getAttribute("title")).toBe("pamCollectionRequiresRequest");
  });

  it("keeps the muted styling alongside the icon's own classes", () => {
    create({ id: COLLECTION, organizationId: PAM_ORG });

    expect(lock()?.classList).toContain("tw-text-muted");
    expect(lock()?.classList).toContain("bwi-lock");
  });

  it("leaves a collection no enabled rule governs unmarked", () => {
    governedCollections.rules$.mockReturnValue(of([accessRule(false, [COLLECTION])]));

    create({ id: COLLECTION, organizationId: PAM_ORG });

    expect(lock()).toBeNull();
  });

  it("leaves a collection of another organization unmarked", () => {
    create({ id: "collection-2", organizationId: PAM_ORG });

    expect(lock()).toBeNull();
  });

  it("does not read rules for an organization without PAM", () => {
    create({ id: COLLECTION, organizationId: PLAIN_ORG });

    expect(lock()).toBeNull();
    expect(governedCollections.rules$).not.toHaveBeenCalled();
  });

  it("does not read rules for a pseudo-collection with no organization", () => {
    create({ id: "AllCollections" });

    expect(lock()).toBeNull();
    expect(governedCollections.rules$).not.toHaveBeenCalled();
  });

  it("does not read rules when the PAM flag is off", () => {
    enabled$.next(false);

    create({ id: COLLECTION, organizationId: PAM_ORG });

    expect(lock()).toBeNull();
    expect(governedCollections.rules$).not.toHaveBeenCalled();
  });
});
