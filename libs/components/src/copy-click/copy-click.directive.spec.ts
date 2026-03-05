import { Component, ElementRef, ViewChild } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ToastService, CopyClickListener, COPY_CLICK_LISTENER } from "../";

import { CopyClickDirective } from "./copy-click.directive";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  template: `
    <button type="button" appCopyClick="no toast shown" #noToast></button>
    <button type="button" appCopyClick="info toast shown" showToast="info" #infoToast></button>
    <button type="button" appCopyClick="success toast shown" showToast #successToast></button>
    <button
      type="button"
      appCopyClick="toast with label"
      showToast
      valueLabel="Content"
      #toastWithLabel
    ></button>
  `,
  imports: [CopyClickDirective],
})
class TestCopyClickComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("noToast") noToastButton!: ElementRef<HTMLButtonElement>;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("infoToast") infoToastButton!: ElementRef<HTMLButtonElement>;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("successToast") successToastButton!: ElementRef<HTMLButtonElement>;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("toastWithLabel") toastWithLabelButton!: ElementRef<HTMLButtonElement>;
}

describe("CopyClickDirective", () => {
  let fixture: ComponentFixture<TestCopyClickComponent>;
  const copyToClipboard = jest.fn();
  const showToast = jest.fn();
  const copyClickListener = mock<CopyClickListener>();

  beforeEach(async () => {
    copyToClipboard.mockClear();
    showToast.mockClear();
    copyClickListener.onCopy.mockClear();

    await TestBed.configureTestingModule({
      imports: [TestCopyClickComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            t: (key: string, ...rest: string[]) => {
              if (rest?.length) {
                return `${key} ${rest.join("")}`;
              }
              return key;
            },
          },
        },
        { provide: PlatformUtilsService, useValue: { copyToClipboard } },
        { provide: ToastService, useValue: { showToast } },
        { provide: COPY_CLICK_LISTENER, useValue: copyClickListener },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestCopyClickComponent);
    fixture.detectChanges();
  });

  it("copies the the value for all variants of toasts ", () => {
    const noToastButton = fixture.componentInstance.noToastButton.nativeElement;

    noToastButton.click();
    expect(copyToClipboard).toHaveBeenCalledWith("no toast shown");

    const infoToastButton = fixture.componentInstance.infoToastButton.nativeElement;

    infoToastButton.click();
    expect(copyToClipboard).toHaveBeenCalledWith("info toast shown");

    const successToastButton = fixture.componentInstance.successToastButton.nativeElement;

    successToastButton.click();
    expect(copyToClipboard).toHaveBeenCalledWith("success toast shown");
  });

  it("does not show a toast when showToast is not present", () => {
    const noToastButton = fixture.componentInstance.noToastButton.nativeElement;

    noToastButton.click();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("shows a success toast when showToast is present", () => {
    const successToastButton = fixture.componentInstance.successToastButton.nativeElement;

    successToastButton.click();
    expect(showToast).toHaveBeenCalledWith({
      message: "copySuccessful",
      variant: "success",
    });
  });

  it("shows the toast variant when set with showToast", () => {
    const infoToastButton = fixture.componentInstance.infoToastButton.nativeElement;

    infoToastButton.click();
    expect(showToast).toHaveBeenCalledWith({
      message: "copySuccessful",
      variant: "info",
    });
  });

  it('includes label in toast message when "copyLabel" is set', () => {
    const toastWithLabelButton = fixture.componentInstance.toastWithLabelButton.nativeElement;

    toastWithLabelButton.click();

    expect(showToast).toHaveBeenCalledWith({
      message: "valueCopied Content",
      variant: "success",
    });
  });

  it("should call copyClickListener.onCopy when value is copied", () => {
    const successToastButton = fixture.componentInstance.successToastButton.nativeElement;

    successToastButton.click();

    expect(copyClickListener.onCopy).toHaveBeenCalledWith("success toast shown");
  });
});
