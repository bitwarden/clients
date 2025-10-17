import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";
import { CipherFormContainer } from "@bitwarden/vault";

import BrowserPopupUtils from "../../../../../../platform/browser/browser-popup-utils";
import { FilePopoutUtilsService } from "../../../../../../tools/popup/services/file-popout-utils.service";

import { OpenAttachmentsComponent } from "./open-attachments.component";

describe("OpenAttachmentsComponent", () => {
  let component: OpenAttachmentsComponent;
  let fixture: ComponentFixture<OpenAttachmentsComponent>;
  let router: Router;
  const showToast = jest.fn();
  const hasPremiumFromAnySource$ = new BehaviorSubject<boolean>(true);
  const openCurrentPagePopout = jest
    .spyOn(BrowserPopupUtils, "openCurrentPagePopout")
    .mockResolvedValue(null);
  const cipherView = {
    id: "5555-444-3333",
    type: CipherType.Login,
    name: "Test Login",
    login: {
      username: "username",
      password: "password",
    },
  } as CipherView;

  const cipherDomain = {
    decrypt: () => cipherView,
  };

  const org = {
    name: "Test Org",
    productTierType: ProductTierType.Enterprise,
  } as Organization;

  const getCipher = jest.fn().mockResolvedValue(cipherDomain);
  const organizations$ = jest.fn().mockReturnValue(of([org]));
  const showFilePopoutMessage = jest.fn().mockReturnValue(false);

  const mockUserId = Utils.newGuid() as UserId;
  const accountService = {
    activeAccount$: of({
      id: mockUserId,
      email: "test@email.com",
      emailVerified: true,
      name: "Test User",
    }),
  };
  const formStatusChange$ = new BehaviorSubject<"enabled" | "disabled">("enabled");

  beforeEach(async () => {
    openCurrentPagePopout.mockClear();
    getCipher.mockClear();
    showToast.mockClear();
    organizations$.mockClear();
    showFilePopoutMessage.mockClear();
    hasPremiumFromAnySource$.next(true);
    formStatusChange$.next("enabled");

    await TestBed.configureTestingModule({
      imports: [OpenAttachmentsComponent, RouterTestingModule],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: BillingAccountProfileStateService, useValue: { hasPremiumFromAnySource$ } },
        {
          provide: CipherService,
          useValue: {
            get: getCipher,
            getKeyForCipherKeyDecryption: () => Promise.resolve(null),
            decrypt: jest.fn().mockResolvedValue(cipherView),
          },
        },
        {
          provide: CipherFormContainer,
          useValue: { formStatusChange$ },
        },
        {
          provide: ToastService,
          useValue: { showToast },
        },
        {
          provide: OrganizationService,
          useValue: { organizations$ },
        },
        {
          provide: FilePopoutUtilsService,
          useValue: { showFilePopoutMessage },
        },
        {
          provide: AccountService,
          useValue: accountService,
        },
        {
          provide: PremiumUpgradePromptService,
          useValue: {
            promptForPremium: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compileComponents();
  });

  beforeEach(async () => {
    fixture = TestBed.createComponent(OpenAttachmentsComponent);
    component = fixture.componentInstance;
    component.cipherId = "5555-444-3333" as CipherId;
    router = TestBed.inject(Router);
    jest.spyOn(router, "navigate").mockResolvedValue(true);
    fixture.detectChanges();
  });

  it("opens attachments in new popout", async () => {
    showFilePopoutMessage.mockReturnValue(true);
    component.canAccessAttachments = true;
    await component.ngOnInit();

    await component.openAttachments();

    expect(router.navigate).toHaveBeenCalledWith(["/attachments"], {
      queryParams: { cipherId: "5555-444-3333" },
    });
    expect(openCurrentPagePopout).toHaveBeenCalledWith(window);
  });

  it("opens attachments in same window", async () => {
    showFilePopoutMessage.mockReturnValue(false);
    component.canAccessAttachments = true;
    await component.ngOnInit();

    await component.openAttachments();

    expect(openCurrentPagePopout).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(["/attachments"], {
      queryParams: { cipherId: "5555-444-3333" },
    });
  });

  it("routes the user to the premium page when they cannot access premium features", async () => {
    const premiumUpgradeService = TestBed.inject(PremiumUpgradePromptService);
    hasPremiumFromAnySource$.next(false);

    await component.openAttachments();

    expect(premiumUpgradeService.promptForPremium).toHaveBeenCalled();
  });

  it("disables attachments when the edit form is disabled", () => {
    formStatusChange$.next("disabled");
    fixture.detectChanges();

    let button = fixture.debugElement.query(By.css("button"));

    expect(button.nativeElement.disabled).toBe(true);

    formStatusChange$.next("enabled");
    fixture.detectChanges();

    button = fixture.debugElement.query(By.css("button"));
    expect(button.nativeElement.disabled).toBe(false);
  });

  describe("Free Orgs", () => {
    beforeEach(() => {
      component.cipherIsAPartOfFreeOrg = false;
    });

    it("sets `cipherIsAPartOfFreeOrg` to false when the cipher is not a part of an organization", async () => {
      cipherView.organizationId = "";

      await component.ngOnInit();

      expect(component.cipherIsAPartOfFreeOrg).toBe(false);
    });

    it("sets `cipherIsAPartOfFreeOrg` to true when the cipher is a part of a free organization", async () => {
      cipherView.organizationId = "888-333-333";
      org.productTierType = ProductTierType.Free;
      org.id = cipherView.organizationId as OrganizationId;

      await component.ngOnInit();

      expect(component.cipherIsAPartOfFreeOrg).toBe(true);
    });

    it("sets `cipherIsAPartOfFreeOrg` to false when the organization is not free", async () => {
      cipherView.organizationId = "888-333-333";
      org.productTierType = ProductTierType.Families;
      org.id = cipherView.organizationId as OrganizationId;

      await component.ngOnInit();

      expect(component.cipherIsAPartOfFreeOrg).toBe(false);
    });

    it("shows toast when the cipher is a part of a free org", async () => {
      component.canAccessAttachments = true;
      component.cipherIsAPartOfFreeOrg = true;

      await component.openAttachments();

      expect(showToast).toHaveBeenCalledWith({
        variant: "error",
        title: null,
        message: "freeOrgsCannotUseAttachments",
      });
    });
  });
});
