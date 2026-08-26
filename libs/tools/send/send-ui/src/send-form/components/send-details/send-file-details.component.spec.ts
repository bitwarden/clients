import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MAX_SDK_FILE_SEND_SIZE_BYTES } from "@bitwarden/common/tools/send/services/send-sdk-api.service";
import { ToastService } from "@bitwarden/components";

import { SendFormService } from "../../abstractions/send-form.service";

import { SendFileDetailsComponent } from "./send-file-details.component";

describe("SendFileDetailsComponent", () => {
  let fixture: ComponentFixture<SendFileDetailsComponent>;
  const mockSendFormService = mock<SendFormService>();
  const mockI18nService = mock<I18nService>();
  const mockToastService = mock<ToastService>();
  const mockConfigService = mock<ConfigService>();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSendFormService.sendFormConfig = { mode: "add", areSendsAllowed: true } as any;
    mockSendFormService.originalSendView.mockReturnValue(null);
    mockI18nService.t.mockImplementation((key) => key);
    // Defaults to on so the existing size-limit tests exercise the guard; the "flag off" tests
    // below override this per-case.
    mockConfigService.getFeatureFlag$.mockReturnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [SendFileDetailsComponent],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: ToastService, useValue: mockToastService },
        { provide: SendFormService, useValue: mockSendFormService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendFileDetailsComponent);
    fixture.detectChanges();
  });

  it("hands the real File off to the send form service when one is selected", () => {
    const file = new File(["hello world"], "notes.txt", { type: "text/plain" });

    fixture.componentInstance.sendFileDetailsForm.controls.file.setValue(file);

    expect(mockSendFormService.setFile).toHaveBeenCalledWith(file);
  });

  it("does not call setFile when the control is cleared", () => {
    fixture.componentInstance.sendFileDetailsForm.controls.file.setValue(null);

    expect(mockSendFormService.setFile).not.toHaveBeenCalled();
  });

  it("rejects a file over the size limit with a translated toast instead of handing it off", () => {
    const oversized = Object.defineProperty(
      new File(["hello world"], "big.bin", { type: "application/octet-stream" }),
      "size",
      { value: MAX_SDK_FILE_SEND_SIZE_BYTES + 1 },
    );

    fixture.componentInstance.sendFileDetailsForm.controls.file.setValue(oversized);

    expect(mockSendFormService.setFile).not.toHaveBeenCalled();
    expect(mockToastService.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "error", message: "maxFileSize" }),
    );
    expect(fixture.componentInstance.sendFileDetailsForm.controls.file.value).toBeNull();
  });

  it("allows a file exactly at the size limit", () => {
    const atLimit = Object.defineProperty(new File(["hello world"], "big.bin"), "size", {
      value: MAX_SDK_FILE_SEND_SIZE_BYTES,
    });

    fixture.componentInstance.sendFileDetailsForm.controls.file.setValue(atLimit);

    expect(mockSendFormService.setFile).toHaveBeenCalledWith(atLimit);
    expect(mockToastService.showToast).not.toHaveBeenCalled();
  });

  describe("when the SDK sends flag is off", () => {
    beforeEach(() => {
      mockConfigService.getFeatureFlag$.mockReturnValue(of(false));
      fixture = TestBed.createComponent(SendFileDetailsComponent);
      fixture.detectChanges();
    });

    it("does not check FeatureFlag.Pm30110SdkSendsApi under any other name", () => {
      expect(mockConfigService.getFeatureFlag$).toHaveBeenCalledWith(
        FeatureFlag.Pm30110SdkSendsApi,
      );
    });

    it("allows a file over the SDK size limit, since the legacy path has no equivalent memory concern", () => {
      const oversized = Object.defineProperty(
        new File(["hello world"], "big.bin", { type: "application/octet-stream" }),
        "size",
        { value: MAX_SDK_FILE_SEND_SIZE_BYTES + 1 },
      );

      fixture.componentInstance.sendFileDetailsForm.controls.file.setValue(oversized);

      expect(mockSendFormService.setFile).toHaveBeenCalledWith(oversized);
      expect(mockToastService.showToast).not.toHaveBeenCalled();
    });
  });

  it("disables the control in edit mode", () => {
    mockSendFormService.sendFormConfig = { mode: "edit", areSendsAllowed: true } as any;

    fixture = TestBed.createComponent(SendFileDetailsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.sendFileDetailsForm.controls.file.disabled).toBe(true);
  });
});
