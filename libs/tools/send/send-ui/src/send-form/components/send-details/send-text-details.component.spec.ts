import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SendFormService } from "../../abstractions/send-form.service";

import { SendTextDetailsComponent } from "./send-text-details.component";

describe("SendTextDetailsComponent", () => {
  let fixture: ComponentFixture<SendTextDetailsComponent>;
  const mockSendFormService = mock<SendFormService>();

  const textarea = () =>
    fixture.debugElement.query(By.css("#text")).nativeElement as HTMLTextAreaElement;

  beforeEach(async () => {
    mockSendFormService.sendFormConfig = { areSendsAllowed: true } as any;

    await TestBed.configureTestingModule({
      imports: [SendTextDetailsComponent],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: SendFormService, useValue: mockSendFormService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendTextDetailsComponent);
  });

  // Regression (PM-39695): the text content field used `[readOnly]` (camelCase), which does not match
  // bitInput's `readonly` input alias, leaving the textarea editable in the read-only view. It must be
  // read-only until the Send is being edited.
  it("is read-only when not editing", () => {
    fixture.componentRef.setInput("editing", false);
    fixture.detectChanges();

    expect(textarea().readOnly).toBe(true);
    expect(fixture.debugElement.query(By.css("#text")).attributes.readonly).toEqual("");
  });

  it("is editable when editing", () => {
    fixture.componentRef.setInput("editing", true);
    fixture.detectChanges();

    expect(textarea().readOnly).toBe(false);
    expect(fixture.debugElement.query(By.css("#text")).attributes.readonly).toBeUndefined();
  });
});
