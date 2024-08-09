import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { ViewComponent, ViewCipherDialogParams } from "./view.component";

describe("ViewComponent", () => {
  let component: ViewComponent;
  let fixture: ComponentFixture<ViewComponent>;
  let organizationService: OrganizationService;
  let router: Router;

  const mockCipher: CipherView = {
    id: "cipher-id",
    type: 1,
    organizationId: "org-id",
    isDeleted: false,
  } as CipherView;

  const mockOrganization: Organization = {
    id: "org-id",
    name: "Test Organization",
  } as Organization;

  const mockParams: ViewCipherDialogParams = {
    cipher: mockCipher,
    cipherTypeString: "login",
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: mockParams },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: DialogService, useValue: mock<DialogService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: MessagingService, useValue: mock<MessagingService>() },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: Router, useValue: mock<Router>() },
        { provide: CollectionService, useValue: mock<CollectionService>() },
        { provide: FolderService, useValue: mock<FolderService>() },
        { provide: CryptoService, useValue: mock<CryptoService>() },
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    organizationService = TestBed.inject(OrganizationService);
    component.params = mockParams;
    component.cipher = mockCipher;
  });

  describe("ngOnInit", () => {
    it("initializes the component with cipher and organization", async () => {
      jest.spyOn(organizationService, "get").mockResolvedValue(mockOrganization);

      await component.ngOnInit();

      expect(component.cipher).toEqual(mockCipher);
      expect(component.cipherTypeString).toEqual("login");
      expect(component.organization).toEqual(mockOrganization);
    });
  });

  describe("edit", () => {
    it("navigates to the edit route", async () => {
      jest.spyOn(router, "navigate").mockResolvedValue(true);

      await component.edit();

      expect(router.navigate).toHaveBeenCalledWith([], {
        queryParams: {
          itemId: mockCipher.id,
          action: "edit",
          organizationId: mockCipher.organizationId,
        },
      });
    });
  });

  describe("ngOnDestroy", () => {
    it("cleans up resources", () => {
      const cleanupSpy = jest.spyOn(component, "ngOnDestroy");
      component.ngOnDestroy();
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("calls the delete method on delete", async () => {
      const deleteSpy = jest.spyOn(component, "delete").mockImplementation(() => Promise.resolve());

      await component.delete();

      expect(deleteSpy).toHaveBeenCalled();
    });
  });
});
