import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessRuleView } from "../abstractions/access-rule";
import { GovernedCollectionsService } from "../services/governed-collections.service";

import { GatedCollectionBannerComponent } from "./gated-collection-banner.component";

function accessRule(enabled: boolean, collections: string[]): AccessRuleView {
  return { enabled, collections } as unknown as AccessRuleView;
}

const PAM_ORG = "org-1" as OrganizationId;
const PLAIN_ORG = "org-2" as OrganizationId;
const OTHER_PAM_ORG = "org-3" as OrganizationId;
const COLLECTION = "collection-1" as CollectionId;

describe("GatedCollectionBannerComponent", () => {
  let fixture: ComponentFixture<GatedCollectionBannerComponent>;
  let enabled$: BehaviorSubject<boolean>;
  let governedCollections: MockProxy<GovernedCollectionsService>;
  let organizations$: BehaviorSubject<{ id: string; usePam: boolean }[]>;

  function create(
    organizationId: OrganizationId | undefined,
    collectionId: CollectionId | undefined,
  ): void {
    fixture = TestBed.createComponent(GatedCollectionBannerComponent);
    fixture.componentRef.setInput("organizationId", organizationId);
    fixture.componentRef.setInput("collectionId", collectionId);
    fixture.detectChanges();
  }

  function banner(): HTMLElement | null {
    return fixture.nativeElement.querySelector("[data-testid='pam-gated-collection-banner']");
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
      imports: [GatedCollectionBannerComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: GovernedCollectionsService, useValue: governedCollections },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    });
  });

  it("explains the restriction on a collection governed by an enabled rule", () => {
    create(PAM_ORG, COLLECTION);

    expect(banner()).not.toBeNull();
    expect(banner()?.textContent).toContain("pamCollectionRequiresRequest");
  });

  it("names the notice's landmark with a label distinct from the sentence it displays", () => {
    create(PAM_ORG, COLLECTION);

    expect(banner()?.querySelector("aside")?.getAttribute("aria-label")).toBe(
      "pamGatedCollectionBannerName",
    );
  });

  it("offers no dismiss control, so the explanation cannot be hidden while the collection is open", () => {
    create(PAM_ORG, COLLECTION);

    expect(banner()?.querySelector("button")).toBeNull();
  });

  it("stays hidden when no enabled rule governs the collection", () => {
    governedCollections.rules$.mockReturnValue(of([accessRule(false, [COLLECTION])]));

    create(PAM_ORG, COLLECTION);

    expect(banner()).toBeNull();
  });

  it("stays hidden when no rule lists the collection", () => {
    create(PAM_ORG, "collection-2" as CollectionId);

    expect(banner()).toBeNull();
  });

  it("stays hidden when only another organization's rule governs that collection id", () => {
    organizations$.next([
      { id: PAM_ORG, usePam: true },
      { id: OTHER_PAM_ORG, usePam: true },
    ]);
    governedCollections.rules$.mockImplementation((organizationId) =>
      of(organizationId === PAM_ORG ? [accessRule(true, [COLLECTION])] : []),
    );

    create(OTHER_PAM_ORG, COLLECTION);

    expect(banner()).toBeNull();
    expect(governedCollections.rules$).toHaveBeenCalledWith(OTHER_PAM_ORG);
  });

  it("does not read rules for an organization without PAM", () => {
    create(PLAIN_ORG, COLLECTION);

    expect(banner()).toBeNull();
    expect(governedCollections.rules$).not.toHaveBeenCalled();
  });

  it("does not read rules when no single collection is the active filter", () => {
    create(undefined, undefined);

    expect(banner()).toBeNull();
    expect(governedCollections.rules$).not.toHaveBeenCalled();
  });

  // `NgComponentOutlet` reuses one banner instance and swaps its inputs, so a verdict left
  // standing from the previous collection is shown over the new one's items.
  it("stops explaining the previous collection's restriction while the new collection's rules load", () => {
    const pendingRules$ = new Subject<AccessRuleView[]>();
    organizations$.next([
      { id: PAM_ORG, usePam: true },
      { id: OTHER_PAM_ORG, usePam: true },
    ]);
    governedCollections.rules$.mockImplementation((organizationId) =>
      organizationId === PAM_ORG ? of([accessRule(true, [COLLECTION])]) : pendingRules$,
    );

    create(PAM_ORG, COLLECTION);
    expect(banner()).not.toBeNull();

    fixture.componentRef.setInput("organizationId", OTHER_PAM_ORG);
    fixture.detectChanges();

    expect(banner()).toBeNull();

    pendingRules$.next([accessRule(true, [COLLECTION])]);
    fixture.detectChanges();

    expect(banner()).not.toBeNull();
  });

  // `getFeatureFlag$` and `organizations$` both re-emit on unrelated upstream events (a config
  // refresh, any sync write) with no de-duplication of their own. A re-run of the rules read on
  // every such re-emission would re-trigger its `startWith(false)` seed and blink a settled
  // banner off and back on, even though the selected collection never changed.
  it("does not re-read rules when an unrelated upstream source re-emits for the same collection", () => {
    create(PAM_ORG, COLLECTION);
    expect(banner()).not.toBeNull();
    expect(governedCollections.rules$).toHaveBeenCalledTimes(1);

    enabled$.next(true);
    fixture.detectChanges();
    organizations$.next([
      { id: PAM_ORG, usePam: true },
      { id: PLAIN_ORG, usePam: false },
    ]);
    fixture.detectChanges();

    expect(banner()).not.toBeNull();
    expect(governedCollections.rules$).toHaveBeenCalledTimes(1);
  });

  it("does not read rules when the PAM flag is off", () => {
    enabled$.next(false);

    create(PAM_ORG, COLLECTION);

    expect(banner()).toBeNull();
    expect(governedCollections.rules$).not.toHaveBeenCalled();
  });
});
