import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SendFormService } from "../../abstractions/send-form.service";

import { SendFileDetailsComponent } from "./send-file-details.component";

describe("SendFileDetailsComponent", () => {
  let fixture: ComponentFixture<SendFileDetailsComponent>;
  const mockSendFormService = mock<SendFormService>();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSendFormService.sendFormConfig = { mode: "add", areSendsAllowed: true } as any;
    mockSendFormService.originalSendView.mockReturnValue(null);

    await TestBed.configureTestingModule({
      imports: [SendFileDetailsComponent],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: SendFormService, useValue: mockSendFormService },
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

  it("disables the control in edit mode", () => {
    mockSendFormService.sendFormConfig = { mode: "edit", areSendsAllowed: true } as any;

    fixture = TestBed.createComponent(SendFileDetailsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.sendFileDetailsForm.controls.file.disabled).toBe(true);
  });
});
