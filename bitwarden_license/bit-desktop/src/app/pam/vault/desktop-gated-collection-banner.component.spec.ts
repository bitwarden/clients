import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import type { AccessRuleView } from "@bitwarden/bit-pam";
import { GovernedCollectionsService } from "@bitwarden/bit-pam-components";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Collection } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import { DesktopGatedCollectionBannerComponent } from "./desktop-gated-collection-banner.component";

const ORG = "org-1" as OrganizationId;
const GATED = "collection-gated" as CollectionId;
const OPEN = "collection-open" as CollectionId;

function organization(overrides: Partial<Organization>): Organization {
  return Object.assign(new Organization(), {
    id: ORG,
    enabled: true,
    isProviderUser: false,
    usePam: true,
    ...overrides,
  });
}

function collection(id: CollectionId, hasEnabledAccessRule: boolean): Collection {
  return { id, organizationId: ORG, hasEnabledAccessRule } as Collection;
}

describe("DesktopGatedCollectionBannerComponent", () => {
  let fixture: ComponentFixture<DesktopGatedCollectionBannerComponent>;
  let enabled$: BehaviorSubject<boolean>;
  let organizations$: BehaviorSubject<Organization[]>;
  let governedCollections: MockProxy<GovernedCollectionsService>;

  function create(collectionId: CollectionId | undefined = GATED): void {
    fixture = TestBed.createComponent(DesktopGatedCollectionBannerComponent);
    fixture.componentRef.setInput("organizationId", ORG);
    fixture.componentRef.setInput("collectionId", collectionId);
    fixture.detectChanges();
  }

  function query(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid='${testId}']`);
  }

  const licensedBanner = () => query("pam-gated-collection-banner");
  const unlicensedBanner = () => query("pam-gated-collection-banner-unlicensed");

  beforeEach(() => {
    enabled$ = new BehaviorSubject<boolean>(true);
    organizations$ = new BehaviorSubject<Organization[]>([organization({ accessPam: true })]);
    governedCollections = mock<GovernedCollectionsService>();
    governedCollections.rules$.mockReturnValue(
      of([{ enabled: true, collections: [GATED] } as unknown as AccessRuleView]),
    );

    TestBed.configureTestingModule({
      imports: [DesktopGatedCollectionBannerComponent],
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$: () => enabled$ } },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        { provide: OrganizationService, useValue: { organizations$: () => organizations$ } },
        {
          provide: CollectionService,
          useValue: {
            encryptedCollections$: () => of([collection(GATED, true), collection(OPEN, false)]),
          },
        },
        { provide: GovernedCollectionsService, useValue: governedCollections },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    });
  });

  describe("licensed member", () => {
    it("shows the shared request notice on a governed shared folder", () => {
      create();

      expect(licensedBanner()?.textContent).toContain("pamSharedFolderRequiresRequest");
      expect(unlicensedBanner()).toBeNull();
    });

    it("shows nothing on a shared folder no rule governs", () => {
      create(OPEN);

      expect(licensedBanner()).toBeNull();
      expect(unlicensedBanner()).toBeNull();
    });
  });

  describe("unlicensed member", () => {
    beforeEach(() => {
      organizations$.next([organization({ accessPam: false })]);
    });

    it("explains the missing license in place of the request notice", () => {
      create();

      expect(unlicensedBanner()?.textContent).toContain("pamSharedFolderUnlicensed");
      expect(licensedBanner()).toBeNull();
    });

    it("names the notice's landmark like the request notice does", () => {
      create();

      expect(unlicensedBanner()?.querySelector("aside")?.getAttribute("aria-label")).toBe(
        "pamGatedCollectionBannerName",
      );
    });

    it("offers no action, so nothing invites a request", () => {
      create();

      expect(unlicensedBanner()?.querySelector("button")).toBeNull();
    });

    it("reads the synced collection, not the access rules a seatless member may be refused", () => {
      governedCollections.rules$.mockReturnValue(of([]));

      create();

      expect(unlicensedBanner()).not.toBeNull();
      expect(governedCollections.rules$).not.toHaveBeenCalled();
    });

    it("shows nothing on a shared folder no rule governs", () => {
      create(OPEN);

      expect(unlicensedBanner()).toBeNull();
      expect(licensedBanner()).toBeNull();
    });

    it("shows nothing with the PAM flag off", () => {
      enabled$.next(false);

      create();

      expect(unlicensedBanner()).toBeNull();
      expect(licensedBanner()).toBeNull();
    });

    it("switches to the request notice once a license is assigned", () => {
      create();
      expect(unlicensedBanner()).not.toBeNull();

      organizations$.next([organization({ accessPam: true })]);
      fixture.detectChanges();

      expect(unlicensedBanner()).toBeNull();
      expect(licensedBanner()).not.toBeNull();
    });
  });

  it("keeps the request notice while the membership has not synced a license verdict", () => {
    organizations$.next([organization({})]);

    create();

    expect(licensedBanner()).not.toBeNull();
    expect(unlicensedBanner()).toBeNull();
  });

  it("shows neither notice until the membership read lands", () => {
    TestBed.overrideProvider(OrganizationService, {
      useValue: { organizations$: () => new Subject<Organization[]>() },
    });

    create();

    expect(licensedBanner()).toBeNull();
    expect(unlicensedBanner()).toBeNull();
  });
});
