import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ButtonComponent } from "@bitwarden/components";
import { CipherAttachmentsComponent } from "@bitwarden/vault";

import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupRouterCacheService } from "../../../../../platform/popup/view-cache/popup-router-cache.service";

import { AttachmentsV2Component } from "./attachments-v2.component";

@Component({
  standalone: true,
  selector: "popup-header",
  template: `<ng-content></ng-content>`,
})
class MockPopupHeaderComponent {
  @Input() pageTitle: string;
}

@Component({
  standalone: true,
  selector: "popup-footer",
  template: `<ng-content></ng-content>`,
})
class MockPopupFooterComponent {
  @Input() pageTitle: string;
}

describe("AttachmentsV2Component", () => {
  let component: AttachmentsV2Component;
  let fixture: ComponentFixture<AttachmentsV2Component>;
  const queryParams = new BehaviorSubject<{ cipherId: string }>({ cipherId: "5555-444-3333" });
  let cipherAttachment: CipherAttachmentsComponent;
  const back = jest.fn();

  const cipherDomain = {
    type: CipherType.Login,
    name: "Test Login",
  };

  const cipherServiceGet = jest.fn().mockResolvedValue(cipherDomain);

  beforeEach(async () => {
    back.mockClear();

    await TestBed.configureTestingModule({
      imports: [AttachmentsV2Component],
      providers: [
        { provide: LogService, useValue: mock<LogService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PopupRouterCacheService, useValue: { back } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams,
          },
        },
        {
          provide: CipherService,
          useValue: {
            get: cipherServiceGet,
          },
        },
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

  it("navigates the user back on `onUploadSuccess`", fakeAsync(() => {
    cipherAttachment.onUploadSuccess.emit();

    tick();

    expect(back).toHaveBeenCalled();
  }));
});
