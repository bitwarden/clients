import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { ButtonComponent } from "@bitwarden/components";
import { CipherAttachmentsComponent } from "@bitwarden/vault";

import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupRouterCacheService } from "../../../../../platform/popup/view-cache/popup-router-cache.service";

import { AttachmentsV2Component } from "./attachments-v2.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
})
class MockPopupHeaderComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() pageTitle: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() backAction: () => void;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "popup-footer",
  template: `<ng-content></ng-content>`,
})
class MockPopupFooterComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() pageTitle: string;
}

describe("AttachmentsV2Component", () => {
  let component: AttachmentsV2Component;
  let fixture: ComponentFixture<AttachmentsV2Component>;
  const queryParams = new BehaviorSubject<{ cipherId: string }>({ cipherId: "5555-444-3333" });
  let cipherAttachment: CipherAttachmentsComponent;
  const navigate = jest.fn();
  const back = jest.fn().mockResolvedValue(undefined);

  const mockUserId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);

  beforeEach(async () => {
    back.mockClear();
    navigate.mockClear();

    await TestBed.configureTestingModule({
      imports: [AttachmentsV2Component],
      providers: [
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: PopupRouterCacheService, useValue: { back } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams,
          },
        },
        {
          provide: AccountService,
          useValue: accountService,
        },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
      ],
    })
      .overrideComponent(AttachmentsV2Component, {
        remove: {
          imports: [PopupHeaderComponent, PopupFooterComponent],
        },
        add: {
          imports: [MockPopupHeaderComponent, MockPopupFooterComponent],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AttachmentsV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();

    cipherAttachment = fixture.debugElement.query(
      By.directive(CipherAttachmentsComponent),
    ).componentInstance;
  });

  it("sets `cipherId` from query params", () => {
    expect(component.cipherId).toBe("5555-444-3333");
  });

  it("passes the submit button to the cipher attachments component", () => {
    const submitBtn = fixture.debugElement.queryAll(By.directive(ButtonComponent))[1]
      .componentInstance;

    expect(cipherAttachment.submitBtn).toEqual(submitBtn);
  });

  it("navigates the user to the edit view `onUploadSuccess`", fakeAsync(() => {
    cipherAttachment.onUploadSuccess.emit();

    tick();

    expect(back).toHaveBeenCalledTimes(1);
  }));
});
