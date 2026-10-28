import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendSdkApiService } from "@bitwarden/common/tools/send/services/send-sdk-api.service";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { ShareLinkService } from "./share-link.service";

const organizationId = "org-1" as OrganizationId;

function cipher(overrides: Partial<CipherView> = {}): CipherView {
  return Object.assign(new CipherView(), {
    id: "cipher-1",
    name: "Item",
    type: CipherType.Login,
    collectionIds: [],
    ...overrides,
  });
}

describe("ShareLinkService", () => {
  let organizationService: MockProxy<OrganizationService>;
  let service: ShareLinkService;

  beforeEach(() => {
    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user-1" } as Account);

    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(true));

    const billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));

    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([]));

    const policyService = mock<PolicyService>();
    policyService.policiesByType$.mockReturnValue(of([]));

    const collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        ShareLinkService,
        { provide: AccountService, useValue: accountService },
        { provide: BillingAccountProfileStateService, useValue: billingAccountProfileStateService },
        { provide: CollectionService, useValue: collectionService },
        { provide: ConfigService, useValue: configService },
        { provide: EnvironmentService, useValue: mock<EnvironmentService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: OrganizationService, useValue: organizationService },
        { provide: PolicyService, useValue: policyService },
        { provide: SendSdkApiService, useValue: mock<SendSdkApiService>() },
        { provide: SendService, useValue: mock<SendService>() },
      ],
    });

    service = TestBed.inject(ShareLinkService);
  });

  describe("cipherCanBeShared$", () => {
    it("allows an ordinary item", async () => {
      expect(await firstValueFrom(service.cipherCanBeShared$(cipher()))).toBe(true);
    });

    it("refuses a gated (partial) item, which is read-only", async () => {
      expect(await firstValueFrom(service.cipherCanBeShared$(cipher({ partial: true })))).toBe(
        false,
      );
    });

    it("refuses a gated (partial) item even where the user can edit every organization item", async () => {
      organizationService.organizations$.mockReturnValue(
        of([{ id: organizationId, canEditAllCiphers: true } as Organization]),
      );

      expect(
        await firstValueFrom(service.cipherCanBeShared$(cipher({ organizationId, partial: true }))),
      ).toBe(false);
    });
  });
});
