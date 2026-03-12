import { NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
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
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { CipherListView, CipherListViewType } from "@bitwarden/sdk-internal";
import {
  VaultFilterServiceAbstraction as VaultFilterService,
  CipherTypeFilter,
  VaultFilterSection,
} from "@bitwarden/vault";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

import { VaultFilterComponent, VaultFilterComponent } from "./vault-filter.component";

const USER_ID = "user-1" as UserId;
const ORG_ID_1 = "org-1" as OrganizationId;
const ORG_ID_2 = "org-2" as OrganizationId;

function cipherStub(params: {
  type: CipherListViewType | CipherType;
  organizationId?: string;
  deletedDate?: string;
}): CipherListView {
  return {
    type: params.type,
    organizationId: params.organizationId ?? undefined,
    deletedDate: params.deletedDate ?? undefined,
  } as unknown as CipherListView;
}

describe("VaultFilterComponent", () => {
  let component: VaultFilterComponent;
  let vaultFilterService: MockProxy<VaultFilterService>;
  let cipherService: MockProxy<CipherService>;
  let restrictedSubject: BehaviorSubject<RestrictedCipherType[]>;

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

    const fixture = TestBed.createComponent(VaultFilterComponent);
    component = fixture.componentInstance;
  });

  describe("addTypeFilter", () => {
    async function getTypeFilterIds(section: VaultFilterSection) {
      const tree = await firstValueFrom(section.data$);
      return tree.children.map((c) => c.node.id);
    }

    describe("when there are no restrictions", () => {
      it("shows all type filters", async () => {
        restrictedSubject.next([]);
        cipherService.cipherListViews$.mockReturnValue(of([]));

        const section = await component.addTypeFilter();
        const ids = await getTypeFilterIds(section);

        expect(ids).toEqual(
          expect.arrayContaining(["favorites", "login", "card", "identity", "note", "sshKey"]),
        );
      });
    });

    describe("when a type is restricted by all orgs (allowViewOrgIds is empty)", () => {
      beforeEach(() => {
        restrictedSubject.next([{ cipherType: CipherType.Card, allowViewOrgIds: [] }]);
      });

      it("hides the restricted type even with CipherListView ciphers present", async () => {
        cipherService.cipherListViews$.mockReturnValue(
          of([cipherStub({ type: { card: { brand: "" } }, organizationId: ORG_ID_1 })]),
        );

        const section = await component.addTypeFilter();
        const ids = await getTypeFilterIds(section);

        expect(ids).not.toContain("card");
        expect(ids).toContain("login");
      });

      it("hides the restricted type even with CipherView ciphers present", async () => {
        cipherService.cipherListViews$.mockReturnValue(
          of([cipherStub({ type: CipherType.Card, organizationId: ORG_ID_1 })]),
        );

        const section = await component.addTypeFilter();
        const ids = await getTypeFilterIds(section);

        expect(ids).not.toContain("card");
      });
    });

    describe("when a type is restricted but some orgs allow it", () => {
      beforeEach(() => {
        restrictedSubject.next([
          { cipherType: CipherType.Card, allowViewOrgIds: [ORG_ID_1 as string] },
        ]);
      });

      it("shows the type when a CipherListView cipher exists in an allowed org", async () => {
        cipherService.cipherListViews$.mockReturnValue(
          of([cipherStub({ type: { card: { brand: "Visa" } }, organizationId: ORG_ID_1 })]),
        );

        const section = await component.addTypeFilter();
        const ids = await getTypeFilterIds(section);

        expect(ids).toContain("card");
      });

      it("shows the type when a CipherView cipher exists in an allowed org", async () => {
        cipherService.cipherListViews$.mockReturnValue(
          of([cipherStub({ type: CipherType.Card, organizationId: ORG_ID_1 })]),
        );

        const section = await component.addTypeFilter();
        const ids = await getTypeFilterIds(section);

        expect(ids).toContain("card");
      });

      it("hides the type when a CipherListView cipher exists but in a non-allowed org", async () => {
        cipherService.cipherListViews$.mockReturnValue(
          of([cipherStub({ type: { card: { brand: "" } }, organizationId: ORG_ID_2 })]),
        );

        const section = await component.addTypeFilter();
        const ids = await getTypeFilterIds(section);

        expect(ids).not.toContain("card");
      });

      it("hides the type when there are no ciphers of that type", async () => {
        cipherService.cipherListViews$.mockReturnValue(
          of([cipherStub({ type: { login: {} } as CipherListViewType, organizationId: ORG_ID_1 })]),
        );

        const section = await component.addTypeFilter();
        const ids = await getTypeFilterIds(section);

        expect(ids).not.toContain("card");
        expect(ids).toContain("login");
      });

      it("hides the type when a matching cipher exists but is deleted", async () => {
        cipherService.cipherListViews$.mockReturnValue(
          of([
            cipherStub({
              type: { card: { brand: "" } },
              organizationId: ORG_ID_1,
              deletedDate: "2025-06-01T00:00:00Z",
            }),
          ]),
        );

        const section = await component.addTypeFilter();
        const ids = await getTypeFilterIds(section);

        expect(ids).not.toContain("card");
      });

      it("hides the type when a matching cipher has no organizationId", async () => {
        cipherService.cipherListViews$.mockReturnValue(
          of([cipherStub({ type: { card: { brand: "" } } })]),
        );

        const section = await component.addTypeFilter();
        const ids = await getTypeFilterIds(section);

        expect(ids).not.toContain("card");
      });
    });

    describe("with organizationId filter parameter", () => {
      beforeEach(() => {
        restrictedSubject.next([
          {
            cipherType: CipherType.Card,
            allowViewOrgIds: [ORG_ID_1 as string, ORG_ID_2 as string],
          },
        ]);
      });

      it("shows the type when a cipher belongs to the filtered org", async () => {
        cipherService.cipherListViews$.mockReturnValue(
          of([cipherStub({ type: { card: { brand: "" } }, organizationId: ORG_ID_1 })]),
        );

        const section = await component.addTypeFilter([], ORG_ID_1 as string);
        const ids = await getTypeFilterIds(section);

        expect(ids).toContain("card");
      });

      it("hides the type when a cipher exists but belongs to a different org than filtered", async () => {
        cipherService.cipherListViews$.mockReturnValue(
          of([cipherStub({ type: { card: { brand: "" } }, organizationId: ORG_ID_2 })]),
        );

        const section = await component.addTypeFilter([], ORG_ID_1 as string);
        const ids = await getTypeFilterIds(section);

        expect(ids).not.toContain("card");
      });
    });
  });
});
