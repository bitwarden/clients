import { CommonModule } from "@angular/common";
import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import {
  VaultFilterServiceAbstraction as VaultFilterService,
  VaultFilterSection,
  VaultFilterType,
} from "@bitwarden/vault";
import { CoachmarkService } from "@bitwarden/web-vault/app/vault/components/coachmark";
import { VAULT_FILTER_GATED_COLLECTION_INDICATOR } from "@bitwarden/web-vault/app/vault/individual-vault/vault-filter/shared/components/pam/vault-filter-gated-collection-indicator.token";
import { VaultFilterSectionComponent } from "@bitwarden/web-vault/app/vault/individual-vault/vault-filter/shared/components/vault-filter-section.component";

import { GatedCollectionFilterIndicatorComponent } from "./gated-collection-filter-indicator.component";

/**
 * `VaultFilterSectionComponent` is shared between the individual vault's Filters sidebar and the
 * Admin Console org collections sidebar (`VaultFilterModule` imports `VaultFilterSharedModule`),
 * and the org template also sets `isCollectionFilter`, so `GatedCollectionFilterIndicatorComponent`
 * mounts and reads `hasEnabledAccessRule` off the node in both hosts identically. This pins that:
 * unlike the removed `listAccessRules` read, nothing here requires organization membership, so a
 * provider browsing a client org's Admin Console sees the same lock a member of the vault does,
 * without providing any org-scoped service.
 */
function collectionSection(hasEnabledAccessRule: boolean): VaultFilterSection {
  const head = { id: "AllCollections", name: "collections" } as unknown as VaultFilterType;
  const headNode = new TreeNode<VaultFilterType>(head, null as unknown as TreeNode<VaultFilterType>);
  const child = {
    id: "collection-1",
    name: "Engineering",
    hasEnabledAccessRule,
  } as unknown as VaultFilterType;
  headNode.children.push(new TreeNode<VaultFilterType>(child, headNode, "Engineering"));

  return {
    data$: of(headNode),
    header: { showHeader: false, isSelectable: false },
    action: jest.fn(),
  } as unknown as VaultFilterSection;
}

describe("GatedCollectionFilterIndicatorComponent hosted in VaultFilterSectionComponent", () => {
  let fixture: ComponentFixture<VaultFilterSectionComponent>;

  const vaultFilterService = mock<VaultFilterService>();

  function create(hasEnabledAccessRule: boolean): void {
    TestBed.configureTestingModule({
      imports: [CommonModule, JslibModule, GatedCollectionFilterIndicatorComponent],
      declarations: [VaultFilterSectionComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: VaultFilterService, useValue: vaultFilterService },
        { provide: CoachmarkService, useValue: mock<CoachmarkService>() },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" as UserId }) } },
        { provide: I18nService, useValue: { t: (key: string): string => key } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
        {
          provide: VAULT_FILTER_GATED_COLLECTION_INDICATOR,
          useValue: GatedCollectionFilterIndicatorComponent,
        },
      ],
    });

    fixture = TestBed.createComponent(VaultFilterSectionComponent);
    fixture.componentInstance.activeFilter = {} as never;
    fixture.componentInstance.isCollectionFilter = true;
    fixture.componentRef.setInput("section", collectionSection(hasEnabledAccessRule));
    fixture.detectChanges();
  }

  function lock(): HTMLElement | null {
    return fixture.nativeElement.querySelector("[data-testid='vault-filter-gated-collection']");
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    vaultFilterService.collapsedFilterNodes$ = of(new Set<string>());
  });

  it("renders the lock for a collection an enabled access rule governs, without any org-membership-scoped provider", () => {
    create(true);

    expect(lock()).not.toBeNull();
  });

  it("renders nothing for a collection no enabled access rule governs", () => {
    create(false);

    expect(lock()).toBeNull();
  });
});
