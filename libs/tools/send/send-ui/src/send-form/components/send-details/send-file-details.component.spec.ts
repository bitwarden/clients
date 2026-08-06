import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendFileView } from "@bitwarden/common/tools/send/models/view/send-file.view";

import { SendFormService } from "../../abstractions/send-form.service";

import { SendFileDetailsComponent } from "./send-file-details.component";

describe("SendFileDetailsComponent", () => {
  let fixture: ComponentFixture<SendFileDetailsComponent>;
  const mockSendFormService = mock<SendFormService>();

  beforeEach(async () => {
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

  // Regression (PM-41233): the file input was bound via `formControlName`, but native file inputs
  // only ever expose a fake path string to reactive forms, never the selected `File`. That string
  // was patched straight onto the SendView, so `SendSdkApiService.buildSendViewType` always saw a
  // missing `fileName` and file-Send creation failed before reaching the SDK.
  it("patches the send with a SendFileView built from the selected file, not the raw input value", () => {
    const file = new File(["hello world"], "notes.txt", { type: "text/plain" });
    const inputElement = fixture.debugElement.query(By.css("input[type=file]"));

    Object.defineProperty(inputElement.nativeElement, "files", {
      value: [file],
      writable: false,
    });
    inputElement.nativeElement.dispatchEvent(new Event("change"));

    expect(mockSendFormService.setFile).toHaveBeenCalledWith(file);
    expect(mockSendFormService.patchSend).toHaveBeenCalled();

    const updateFn = mockSendFormService.patchSend.mock.calls[0][0];
    const patchedSend = updateFn({} as any);

    expect(patchedSend.file).toBeInstanceOf(SendFileView);
    expect(patchedSend.file.fileName).toEqual("notes.txt");
    expect(patchedSend.file.size).toEqual(file.size.toString());
  });
});
