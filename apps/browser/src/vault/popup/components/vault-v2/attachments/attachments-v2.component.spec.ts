import { Component, Input } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { ButtonComponent } from "@bitwarden/components";

import { PopupFooterComponent } from "../../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";

import { AttachmentsV2Component } from "./attachments-v2.component";
import { CipherAttachmentsComponent } from "./cipher-attachments/cipher-attachments.component";

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttachmentsV2Component],
      providers: [
        { provide: LogService, useValue: mock<LogService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: ConfigService, useValue: mock<ConfigService>() },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams,
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

  it("shows loading state on upload button", () => {
    cipherAttachment.formLoading.emit(true);
    fixture.detectChanges();

    const uploadButton = fixture.debugElement.queryAll(By.directive(ButtonComponent))[1];

    expect(uploadButton.componentInstance.loading).toBe(true);
  });

  it("disables upload when form is invalid", () => {
    cipherAttachment.formStatusChange.emit("INVALID");
    fixture.detectChanges();

    const uploadButton = fixture.debugElement.query(By.css('button[type="submit"]'));
    expect(uploadButton.nativeElement.disabled).toBe(true);
  });

  it("disables upload when `formDisabled` is true", () => {
    cipherAttachment.formStatusChange.emit("VALID");
    cipherAttachment.formDisabled.emit(true);

    fixture.detectChanges();

    const uploadButton = fixture.debugElement.query(By.css('button[type="submit"]'));
    expect(uploadButton.nativeElement.disabled).toBe(true);
  });
});
