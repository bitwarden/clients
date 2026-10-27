import { ChangeDetectionStrategy, Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NavigationEnd, provideRouter, Router } from "@angular/router";
import {
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/../spec/fake-account-service";
import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, filter, firstValueFrom, of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { NavigationModule, SideNavService, ToastService } from "@bitwarden/components";
import { GlobalStateProvider } from "@bitwarden/state";

import { PinnedSharedFoldersService } from "../../services/pinned-shared-folders.service";
import { BULK_DELETE_DIALOG, BulkDeleteDialogRef } from "../../tokens/bulk-delete-dialog.token";
import { COLLECTION_DIALOG, CollectionDialogRef } from "../../tokens/collection-dialog.token";

import { VaultPinnedNavComponent } from "./vault-pinned-nav.component";

const userId = "user-id" as UserId;
const orgId = "org-a" as OrganizationId;

const collection = (id: string, name: string, organizationId = orgId) => {
  const view = new CollectionView({ id: id as CollectionId, organizationId, name });
  view.manage = true;
  return view;
};

@Component({ template: "", changeDetection: ChangeDetectionStrategy.OnPush })
class DummyComponent {}

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe("VaultPinnedNavComponent", () => {
  let fixture: ComponentFixture<VaultPinnedNavComponent>;
  let service: PinnedSharedFoldersService;

  const collections$ = new BehaviorSubject<CollectionView[]>([]);
  const i18nService = mock<I18nService>();

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? "";
  const items = () => Array.from(fixture.nativeElement.querySelectorAll("bit-nav-item"));
  const groups = () => fixture.nativeElement.querySelectorAll("bit-nav-group");

  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    collections$.next([]);
    i18nService.t.mockImplementation((key: string) => key);

    const accountService: FakeAccountService = mockAccountServiceWith(userId);

    await TestBed.configureTestingModule({
      imports: [VaultPinnedNavComponent, NavigationModule],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: StateProvider, useValue: new FakeStateProvider(accountService) },
        { provide: I18nService, useValue: i18nService },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: GlobalStateProvider, useValue: new FakeGlobalStateProvider() },
        {
          provide: OrganizationService,
          useValue: mock<OrganizationService>({
            organizations$: () => of([{ id: orgId, isAdmin: false } as Organization]),
          }),
        },
        { provide: COLLECTION_DIALOG, useValue: mock<CollectionDialogRef>() },
        { provide: BULK_DELETE_DIALOG, useValue: mock<BulkDeleteDialogRef>() },
        {
          provide: CollectionService,
          useValue: mock<CollectionService>({ decryptedCollections$: () => collections$ }),
        },
        provideRouter([
          { path: "vault/:vaultId", component: DummyComponent },
          { path: "vault/:vaultId/shared-folders", component: DummyComponent },
          { path: "vault/:vaultId/shared-folders/:collectionId", component: DummyComponent },
        ]),
      ],
    }).compileComponents();

    TestBed.inject(SideNavService).open.set(true);
    service = TestBed.inject(PinnedSharedFoldersService);

    fixture = TestBed.createComponent(VaultPinnedNavComponent);
    fixture.componentRef.setInput("organizationId", orgId);
    fixture.detectChanges();
    await settle();
  });

  describe("with nothing pinned", () => {
    it("shows the Pinned heading and the empty state", () => {
      expect(text()).toContain("pinned");
      expect(text()).toContain("pinnedEmptyStatePrefix");
      expect(text()).toContain("pinToSidebar");
      expect(text()).toContain("pinnedEmptyStateSuffix");
    });

    it("hides the empty state for good once it is dismissed", async () => {
      (fixture.nativeElement.querySelector("bit-nav-section-empty button") as HTMLElement).click();
      await settle();

      expect(text()).not.toContain("pinnedEmptyStatePrefix");
      expect(text()).not.toContain("pinned");
    });

    it("keeps the dismissal across a fresh render", async () => {
      await service.dismissEmptyState(userId);

      const next = TestBed.createComponent(VaultPinnedNavComponent);
      next.componentRef.setInput("organizationId", orgId);
      next.detectChanges();
      await next.whenStable();
      next.detectChanges();

      expect((next.nativeElement as HTMLElement).textContent?.trim()).toBe("");
    });

    it("shows the empty state for an organization with no shared folders", () => {
      collections$.next([]);

      expect(text()).toContain("pinnedEmptyStatePrefix");
    });
  });

  describe("with folders pinned", () => {
    beforeEach(() => {
      collections$.next([
        collection("1", "Design"),
        collection("2", "Design/Brand"),
        collection("3", "Finance"),
        collection("4", "Other org", "org-b" as OrganizationId),
      ]);
    });

    it("replaces the empty state with the pinned folders, and never brings it back", async () => {
      await service.pin(userId, "3" as CollectionId);
      await settle();

      expect(text()).not.toContain("pinnedEmptyStatePrefix");
      expect(text()).toContain("Finance");

      await service.unpin(userId, "3" as CollectionId);
      await settle();

      expect(text()).not.toContain("pinnedEmptyStatePrefix");
      expect(text()).not.toContain("Finance");
    });

    it("unpins a folder from its options menu", async () => {
      await service.pin(userId, "3" as CollectionId);
      await settle();

      (fixture.nativeElement.querySelector("button[bitIconButton]") as HTMLElement).click();
      await settle();
      (document.querySelector("#vault-pinned-nav_menu-item_unpin-3") as HTMLElement).click();
      await settle();

      expect(text()).not.toContain("Finance");
    });

    it("offers Unpin only on folders the user pinned", async () => {
      await service.pin(userId, "1" as CollectionId);
      await settle();
      (
        fixture.nativeElement.querySelector(
          "[data-testid='nav-group-collapse-arrow']",
        ) as HTMLElement
      ).click();
      await settle();

      const optionButtons = Array.from(
        fixture.nativeElement.querySelectorAll("button[aria-haspopup='menu']"),
      ) as HTMLElement[];
      expect(optionButtons).toHaveLength(2);

      optionButtons[1].click();
      await settle();

      expect(document.querySelector("[id^='vault-pinned-nav_menu-item_edit-']")).not.toBeNull();
      expect(document.querySelector("[id^='vault-pinned-nav_menu-item_unpin-']")).toBeNull();
    });

    it("leaves a folder's page for the shared folders list once the folder is deleted", async () => {
      await service.pin(userId, "3" as CollectionId);
      await settle();
      const router = TestBed.inject(Router);
      await router.navigateByUrl("/vault/org-a/shared-folders/3");
      await settle();

      const redirected = firstValueFrom(
        router.events.pipe(filter((event) => event instanceof NavigationEnd)),
      );
      collections$.next([collection("1", "Design"), collection("2", "Design/Brand")]);
      await settle();
      await redirected;

      expect(router.url).toBe("/vault/org-a/shared-folders");
    });

    it("links a leaf folder to its folder in the organization's vault", async () => {
      await service.pin(userId, "3" as CollectionId);
      await settle();

      const link = (items()[0] as HTMLElement).querySelector("a");
      expect(link?.getAttribute("href")).toBe("/vault/org-a/shared-folders/3");
    });

    it("renders a folder with nested folders as a group that the row links, not toggles", async () => {
      await service.pin(userId, "1" as CollectionId);
      await settle();

      expect(groups()).toHaveLength(1);
      const group = fixture.nativeElement.querySelector("bit-nav-group") as HTMLElement;
      expect(group.querySelector("a")?.getAttribute("href")).toBe("/vault/org-a/shared-folders/1");
      // Collapsed until the chevron is used.
      expect(text()).not.toContain("Brand");
    });

    it("expands the nested folders from the chevron", async () => {
      await service.pin(userId, "1" as CollectionId);
      await settle();

      (
        fixture.nativeElement.querySelector(
          "[data-testid='nav-group-collapse-arrow']",
        ) as HTMLElement
      ).click();
      await settle();

      expect(text()).toContain("Brand");
      const brand = items().find((el) => (el as HTMLElement).textContent?.includes("Brand"));
      expect((brand as HTMLElement).querySelector("a")?.getAttribute("href")).toBe(
        "/vault/org-a/shared-folders/2",
      );
    });

    it("hides ids that resolve to nothing, without unpinning them", async () => {
      await service.pin(userId, "gone" as CollectionId);
      await service.pin(userId, "3" as CollectionId);
      await settle();

      expect(text()).toContain("Finance");
      expect(text()).not.toContain("gone");
      expect(await firstPinned()).toEqual(["gone", "3"]);
    });

    it("ignores folders pinned in another organization", async () => {
      await service.pin(userId, "4" as CollectionId);
      await settle();

      expect(text()).not.toContain("Other org");
      expect(text().trim()).toBe("");
    });
  });

  const firstPinned = () => firstValueFrom(service.pinnedIds$(userId));
});
