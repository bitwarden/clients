import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { VaultNavItemType, VaultsNavViewModel } from "../../models/vault-nav-view-model";
import { MY_ITEMS_ROUTE, VaultScope, VaultScopeType } from "../../models/vault-scope";
import { VaultNavService } from "../../services/vault-nav.service";

import { VaultBreadcrumbsComponent } from "./vault-breadcrumbs.component";

const userId = "user-1" as UserId;
const organizationId = "org-1" as OrganizationId;
const myItemsCollectionId = "col-my-items" as CollectionId;
const engineeringId = "col-engineering" as CollectionId;
const backendId = "col-backend" as CollectionId;

const buildCollection = (id: CollectionId, name: string) =>
  new CollectionView({ id, organizationId, name });

describe("VaultBreadcrumbsComponent", () => {
  let fixture: ComponentFixture<VaultBreadcrumbsComponent>;
  let collections$: BehaviorSubject<CollectionView[]>;
  let vaultNav$: BehaviorSubject<VaultsNavViewModel>;

  const component = () => fixture.componentInstance as any;

  const scopeTo = (scope: VaultScope) => {
    fixture.componentRef.setInput("scope", scope);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    collections$ = new BehaviorSubject<CollectionView[]>([]);
    vaultNav$ = new BehaviorSubject<VaultsNavViewModel>({
      vaults: [
        {
          id: organizationId,
          label: "Acme corporation",
          icon: "bwi-business",
          type: VaultNavItemType.Organization,
          defaultUserCollectionId: myItemsCollectionId,
        },
      ],
      organizationDataOwnership: true,
    });

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as Account);

    const collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$.mockReturnValue(collections$);

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [VaultBreadcrumbsComponent],
      providers: [
        { provide: AccountService, useValue: accountService },
        { provide: CollectionService, useValue: collectionService },
        { provide: I18nService, useValue: i18nService },
        { provide: VaultNavService, useValue: { viewModel$: () => vaultNav$ } },
      ],
    })
      .overrideComponent(VaultBreadcrumbsComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(VaultBreadcrumbsComponent);
  });

  it("trails the whole organization vault with an All vault items crumb", () => {
    scopeTo({ type: VaultScopeType.Organization, organizationId });

    expect(component().trailCrumbs()).toEqual([
      {
        key: "all-vault-items",
        icon: "bwi-list-alt",
        label: "allVaultItems",
        route: [],
        queryParamsHandling: "preserve",
      },
    ]);
  });

  it("does not link the organization root crumb on the All vault items page", () => {
    scopeTo({ type: VaultScopeType.Organization, organizationId });

    expect(component().orgRootCrumbRoute()).toBeUndefined();
  });

  it("trails My items when the URL names it by sentinel", () => {
    scopeTo({ type: VaultScopeType.Organization, organizationId, collectionId: MY_ITEMS_ROUTE });

    expect(component().trailCrumbs()).toEqual([
      {
        key: "my-items",
        icon: "bwi-user",
        label: "myItemsV2",
        route: [],
        queryParamsHandling: "preserve",
      },
    ]);
    expect(component().orgRootCrumbRoute()).toEqual(["/vault", organizationId]);
  });

  it("trails My items when the scope carries the resolved collection id", () => {
    scopeTo({
      type: VaultScopeType.Organization,
      organizationId,
      collectionId: myItemsCollectionId,
    });

    expect(component().trailCrumbs()).toEqual([
      {
        key: "my-items",
        icon: "bwi-user",
        label: "myItemsV2",
        route: [],
        queryParamsHandling: "preserve",
      },
    ]);
  });

  it("trails a shared folder through its ancestors to the folder in view", () => {
    collections$.next([
      buildCollection(engineeringId, "Engineering"),
      buildCollection(backendId, "Engineering/Backend"),
    ]);
    scopeTo({ type: VaultScopeType.Organization, organizationId, collectionId: backendId });

    expect(component().trailCrumbs()).toEqual([
      {
        key: "shared-folders",
        icon: "bwi-shared-folder",
        label: "sharedFolders",
        route: ["/vault", organizationId, "shared-folders"],
      },
      {
        key: engineeringId,
        icon: "bwi-shared-folder",
        label: "Engineering",
        route: ["/vault", organizationId, "shared-folders", engineeringId],
      },
      {
        key: "shared-folder",
        icon: "bwi-shared-folder",
        label: "Backend",
        route: [],
        queryParamsHandling: "preserve",
      },
    ]);
  });
});
