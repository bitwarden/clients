import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import { KeyService } from "@bitwarden/key-management";
import { CipherFormConfig, DefaultCipherFormConfigService } from "@bitwarden/vault";

import { AddEditComponentV2 } from "./add-edit-v2.component";

describe("AddEditComponentV2", () => {
  let component: AddEditComponentV2;
  let fixture: ComponentFixture<AddEditComponentV2>;
  let organizationService: MockProxy<OrganizationService>;
  let policyService: MockProxy<PolicyService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let activatedRoute: MockProxy<ActivatedRoute>;
  let dialogRef: MockProxy<DialogRef<any>>;
  let dialogService: MockProxy<DialogService>;
  let cipherService: MockProxy<CipherService>;
  let messagingService: MockProxy<MessagingService>;
  let folderService: MockProxy<FolderService>;
  let collectionService: MockProxy<CollectionService>;
  let accountService: MockProxy<AccountService>;

  const mockParams = {
    cloneMode: false,
    cipherFormConfig: mock<CipherFormConfig>(),
  };

  beforeEach(async () => {
    const mockOrganization: Organization = {
      id: "org-id",
      name: "Test Organization",
    } as Organization;

    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([mockOrganization]));

    policyService = mock<PolicyService>();
    policyService.policyAppliesToActiveUser$.mockImplementation((policyType: PolicyType) =>
      of(true),
    );

    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockImplementation((userId) =>
      of(true),
    );

    activatedRoute = mock<ActivatedRoute>();
    activatedRoute.queryParams = of({});

    dialogRef = mock<DialogRef<any>>();
    dialogService = mock<DialogService>();
    messagingService = mock<MessagingService>();
    folderService = mock<FolderService>();
    folderService.folderViews$ = of([]);
    collectionService = mock<CollectionService>();
    collectionService.decryptedCollections$ = of([]);

    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "test-id" } as any);

    const mockDefaultCipherFormConfigService = {
      buildConfig: jest.fn().mockResolvedValue({
        allowPersonal: true,
        allowOrganization: true,
      }),
    };

    await TestBed.configureTestingModule({
      imports: [AddEditComponentV2],
      providers: [
        { provide: DIALOG_DATA, useValue: mockParams },
        { provide: DialogRef, useValue: dialogRef },
        { provide: I18nService, useValue: { t: jest.fn().mockReturnValue("login") } },
        { provide: DialogService, useValue: dialogService },
        { provide: CipherService, useValue: cipherService },
        { provide: MessagingService, useValue: messagingService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: Router, useValue: mock<Router>() },
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: CollectionService, useValue: collectionService },
        { provide: FolderService, useValue: folderService },
        { provide: KeyService, useValue: mock<KeyService>() },
        { provide: BillingAccountProfileStateService, useValue: billingAccountProfileStateService },
        { provide: PolicyService, useValue: policyService },
        { provide: DefaultCipherFormConfigService, useValue: mockDefaultCipherFormConfigService },
        {
          provide: PasswordGenerationServiceAbstraction,
          useValue: mock<PasswordGenerationServiceAbstraction>(),
        },
        { provide: AccountService, useValue: accountService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddEditComponentV2);
    component = fixture.componentInstance;
  });

  describe("ngOnInit", () => {
    it("initializes the component with cipher", async () => {
      await component.ngOnInit();

      expect(component).toBeTruthy();
    });
  });

  describe("cancel", () => {
    it("handles cancel action", async () => {
      const spyClose = jest.spyOn(dialogRef, "close");

      await component.cancel();

      expect(spyClose).toHaveBeenCalled();
    });
  });
});
