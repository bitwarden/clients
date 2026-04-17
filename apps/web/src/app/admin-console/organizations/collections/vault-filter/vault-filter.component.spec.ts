import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Observable, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  VaultFilterServiceAbstraction as VaultFilterService,
  CipherTypeFilter,
  VaultFilterSection,
} from "@bitwarden/vault";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import { VaultFilterComponent } from "./vault-filter.component";

const USER_ID = "user-1" as UserId;
const ORG_ID = "org-1" as OrganizationId;

function cipherViewStub(params: {
  type: CipherType;
  organizationId?: OrganizationId | string;
  deletedDate?: Date;
}): CipherView {
  const c = new CipherView();
  c.type = params.type;
  c.organizationId = (params.organizationId as OrganizationId) ?? null;
  c.deletedDate = params.deletedDate ?? null;
  return c;
}

describe("OrganizationVaultFilterComponent", () => {
  let fixture: ComponentFixture<VaultFilterComponent>;
  let component: VaultFilterComponent;
  let vaultFilterService: MockProxy<VaultFilterService>;
  let cipherService: MockProxy<CipherService>;
  let restrictedSubject: BehaviorSubject<RestrictedCipherType[]>;

  /** Helper to set the ciphers$ signal input via the fixture. */
  function setCiphers(ciphers$: Observable<CipherView[]>) {
    fixture.componentRef.setInput("ciphers$", ciphers$);
  }

  beforeEach(async () => {
    vaultFilterService = mock<VaultFilterService>();
    vaultFilterService.buildTypeTree.mockImplementation((head, array) => {
      const headNode = new TreeNode<CipherTypeFilter>(head, null);
      array?.forEach((filter: CipherTypeFilter) => {
        const node = new TreeNode<CipherTypeFilter>(filter, headNode, filter.name);
        headNode.children.push(node);
      });
      return of(headNode);
    });

    const policyService = mock<PolicyService>();
    policyService.policyAppliesToUser$.mockReturnValue(of(false));
    policyService.policiesByType$.mockReturnValue(of([]));

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    cipherService = mock<CipherService>();
    cipherService.cipherListViews$.mockReturnValue(of([]));

    restrictedSubject = new BehaviorSubject<RestrictedCipherType[]>([]);

    const accountService = mockAccountServiceWith(USER_ID);

    await TestBed.configureTestingModule({
      declarations: [VaultFilterComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: VaultFilterService, useValue: vaultFilterService },
        { provide: PolicyService, useValue: policyService },
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: BillingApiServiceAbstraction, useValue: mock<BillingApiServiceAbstraction>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: AccountService, useValue: accountService },
        {
          provide: RestrictedItemTypesService,
          useValue: { restricted$: restrictedSubject.asObservable() },
        },
        { provide: CipherService, useValue: cipherService },
        { provide: CipherArchiveService, useValue: mock<CipherArchiveService>() },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        { provide: OrganizationWarningsService, useValue: mock<OrganizationWarningsService>() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultFilterComponent);
    component = fixture.componentInstance;
  });

  describe("addTypeFilter", () => {
    async function getTypeFilterIds(section: VaultFilterSection) {
      const tree = await firstValueFrom(section.data$);
      return tree.children.map((c) => c.node.id);
    }

    it("does not call cipherListViews$ (prevents personal vault decrypt)", async () => {
      setCiphers(of([]));
      restrictedSubject.next([]);

      await (component as any).addTypeFilter(["favorites"], ORG_ID as string);

      expect(cipherService.cipherListViews$).not.toHaveBeenCalled();
    });

    describe("when there are no restrictions", () => {
      it("shows all non-favorites type filters when ciphers$ emits empty", async () => {
        setCiphers(of([]));
        restrictedSubject.next([]);

        const section = await (component as any).addTypeFilter(["favorites"], ORG_ID as string);
        const ids = await getTypeFilterIds(section);

        expect(ids).toEqual(
          expect.arrayContaining(["login", "card", "identity", "note", "sshKey"]),
        );
        expect(ids).not.toContain("favorites");
      });
    });

    describe("when a type is restricted by all orgs (allowViewOrgIds is empty)", () => {
      beforeEach(() => {
        restrictedSubject.next([{ cipherType: CipherType.Card, allowViewOrgIds: [] }]);
      });

      it("hides the restricted type regardless of ciphers$ content", async () => {
        setCiphers(of([cipherViewStub({ type: CipherType.Card, organizationId: ORG_ID })]));

        const section = await (component as any).addTypeFilter(["favorites"], ORG_ID as string);
        const ids = await getTypeFilterIds(section);

        expect(ids).not.toContain("card");
        expect(ids).toContain("login");
      });
    });

    describe("when a type is restricted but some orgs allow it", () => {
      beforeEach(() => {
        restrictedSubject.next([
          { cipherType: CipherType.Card, allowViewOrgIds: [ORG_ID as string] },
        ]);
      });

      it("shows the type when ciphers$ emits a matching org cipher", async () => {
        setCiphers(of([cipherViewStub({ type: CipherType.Card, organizationId: ORG_ID })]));

        const section = await (component as any).addTypeFilter(["favorites"], ORG_ID as string);
        const ids = await getTypeFilterIds(section);

        expect(ids).toContain("card");
      });

      it("hides the type when ciphers$ emits a cipher in a different org", async () => {
        setCiphers(
          of([
            cipherViewStub({
              type: CipherType.Card,
              organizationId: "other-org" as OrganizationId,
            }),
          ]),
        );

        const section = await (component as any).addTypeFilter(["favorites"], ORG_ID as string);
        const ids = await getTypeFilterIds(section);

        expect(ids).not.toContain("card");
      });

      it("hides the type when ciphers$ emits a deleted cipher", async () => {
        setCiphers(
          of([
            cipherViewStub({
              type: CipherType.Card,
              organizationId: ORG_ID,
              deletedDate: new Date("2025-06-01"),
            }),
          ]),
        );

        const section = await (component as any).addTypeFilter(["favorites"], ORG_ID as string);
        const ids = await getTypeFilterIds(section);

        expect(ids).not.toContain("card");
      });

      it("hides the type when ciphers$ emits a cipher with no organizationId", async () => {
        setCiphers(of([cipherViewStub({ type: CipherType.Card })]));

        const section = await (component as any).addTypeFilter(["favorites"], ORG_ID as string);
        const ids = await getTypeFilterIds(section);

        expect(ids).not.toContain("card");
      });

      it("updates the type filter reactively when ciphers$ emits a new value", async () => {
        const ciphersSubject = new BehaviorSubject<CipherView[]>([]);
        setCiphers(ciphersSubject.asObservable());

        const section: VaultFilterSection = await (component as any).addTypeFilter(
          ["favorites"],
          ORG_ID as string,
        );

        const getIds = async () =>
          firstValueFrom(section.data$).then((tree) => tree.children.map((c) => c.node.id));

        // Initially no card ciphers — card should be hidden
        expect(await getIds()).not.toContain("card");

        // Push an org card cipher — card should now appear
        ciphersSubject.next([cipherViewStub({ type: CipherType.Card, organizationId: ORG_ID })]);
        expect(await getIds()).toContain("card");
      });
    });

    describe("ciphers$ default value", () => {
      it("defaults to of([]) and does not throw when not explicitly bound", async () => {
        // No setCiphers() call — relies on the input() default of of([])
        restrictedSubject.next([]);

        const section = await (component as any).addTypeFilter(["favorites"], ORG_ID as string);
        const ids = await getTypeFilterIds(section);

        expect(ids).toEqual(
          expect.arrayContaining(["login", "card", "identity", "note", "sshKey"]),
        );
      });
    });

    describe("buildAllFilters wiring", () => {
      it("passes the organization id and excludes favorites when building type filter", async () => {
        const org = { id: ORG_ID } as Organization;
        component.organization = org;
        setCiphers(of([]));
        restrictedSubject.next([]);

        jest.spyOn(component as any, "addTypeFilter").mockResolvedValue({
          data$: of(new TreeNode({ id: "AllItems", name: "allItems", type: "all" }, null)),
          header: { showHeader: true, isSelectable: true },
          action: jest.fn(),
        });

        (component as any).addCollectionFilter = jest.fn().mockResolvedValue({});

        (component as any).addTrashFilter = jest.fn().mockResolvedValue({});

        await component.buildAllFilters();

        expect((component as any).addTypeFilter).toHaveBeenCalledWith(["favorites"], ORG_ID);
      });
    });
  });
});
