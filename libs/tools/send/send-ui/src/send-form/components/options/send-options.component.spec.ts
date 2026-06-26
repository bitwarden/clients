import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";

import { SendPolicyService } from "../../..";
import { SendFormService } from "../../abstractions/send-form.service";

import { SendOptionsComponent } from "./send-options.component";
describe("SendOptionsComponent", () => {
  let component: SendOptionsComponent;
  let fixture: ComponentFixture<SendOptionsComponent>;
  const mockSendFormService = mock<SendFormService>();
  const cycleChangeDetection = () => {
    fixture.componentRef.setInput("editing", !fixture.componentInstance.editing());
    fixture.detectChanges();
    fixture.componentRef.setInput("editing", !fixture.componentInstance.editing());
    fixture.detectChanges();
  };
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendOptionsComponent],
      declarations: [],
      providers: [
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: SendFormService, useValue: mockSendFormService },
        { provide: SendPolicyService, useValue: { disableHideEmail$: of(false) } },
        { provide: AccountService, useValue: of({ id: "userId" } as Account) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SendOptionsComponent);
    component = fixture.componentInstance;
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it("should create", () => {
    expect(component).toBeTruthy();
  });
  describe("View mode", () => {
    beforeEach(async () => {
      fixture.componentRef.setInput("editing", false);
      fixture.detectChanges();
    });
    it("should not display the section at all if none of its fields are visible", () => {
      const cardEl = fixture.debugElement.query(By.css("bit-card"));
      expect(cardEl).toBeNull();
    });
    it.each([
      { maxAccessCount: 5 } as SendView,
      { hideEmail: true } as SendView,
      { notes: "My private note" } as SendView,
    ])(
      "should display the section if any one of its subfields is visible",
      async (originalSendView) => {
        mockSendFormService.originalSendView.mockReturnValue(originalSendView);
        cycleChangeDetection();
        const cardEl = fixture.debugElement.query(By.css("bit-card"));
        expect(cardEl).toBeTruthy();
      },
    );
    it("should display all subfields as readonly or disabled if they are defined", async () => {
      mockSendFormService.originalSendView.mockReturnValue({
        maxAccessCount: 5,
        hideEmail: true,
        notes: "My private note",
      } as SendView);
      cycleChangeDetection();
      const maxAccessCountEl = fixture.debugElement.query(
        By.css("#send-options_input_max-access-count"),
      );
      expect(maxAccessCountEl).toBeTruthy();
      expect(maxAccessCountEl.attributes.readonly).toEqual("");
      const hideEmailEl = fixture.debugElement.query(By.css("input[type=checkbox]"));
      expect(hideEmailEl).toBeTruthy();
      expect(hideEmailEl.attributes.disabled).toEqual("");
      const privateNoteEl = fixture.debugElement.query(By.css("textarea"));
      expect(privateNoteEl).toBeTruthy();
      expect(privateNoteEl.attributes.readonly).toEqual("");
    });
  });
  describe("Edit mode", () => {
    beforeEach(async () => {
      fixture.componentRef.setInput("editing", true);
      await fixture.whenStable();
    });
    it("should display all fields whether or not they are defined", async () => {
      await mockSendFormService.initializeSendForm({
        areSendsAllowed: true,
        mode: "edit",
        originalSend: {} as Send,
        sendType: SendType.Text,
      });
      fixture.detectChanges();
      const maxAccessCountEl = fixture.debugElement.query(
        By.css("#send-options_input_max-access-count"),
      );
      expect(maxAccessCountEl).toBeTruthy();
      const hideEmailEl = fixture.debugElement.query(By.css("input[type=checkbox]"));
      expect(hideEmailEl).toBeTruthy();
      const privateNoteEl = fixture.debugElement.query(By.css("textarea"));
      expect(privateNoteEl).toBeTruthy();
    });
  });
  describe("Max access count increment/decrement", () => {
    beforeEach(async () => {
      mockSendFormService.originalSendView.mockReturnValue({ maxAccessCount: 3 } as SendView);
      fixture.componentRef.setInput("editing", true);
      fixture.detectChanges();
      await fixture.whenStable();
    });
    it("should show +/- buttons in edit mode", () => {
      const incrementBtn = fixture.debugElement.query(
        By.css("[data-testid='increment-max-access-count']"),
      );
      const decrementBtn = fixture.debugElement.query(
        By.css("[data-testid='decrement-max-access-count']"),
      );
      expect(incrementBtn).toBeTruthy();
      expect(decrementBtn).toBeTruthy();
    });
    it("should not show +/- buttons in view mode", () => {
      fixture.componentRef.setInput("editing", false);
      fixture.detectChanges();
      const incrementBtn = fixture.debugElement.query(
        By.css("[data-testid='increment-max-access-count']"),
      );
      expect(incrementBtn).toBeNull();
    });
    it("should increment maxAccessCount when + button clicked", () => {
      component.sendOptionsForm.patchValue({ maxAccessCount: "3" });
      component.incrementMaxAccessCount();
      expect(component.sendOptionsForm.get("maxAccessCount")?.value).toBe("4");
    });
    it("should decrement maxAccessCount when - button clicked", () => {
      component.sendOptionsForm.patchValue({ maxAccessCount: "3" });
      component.decrementMaxAccessCount();
      expect(component.sendOptionsForm.get("maxAccessCount")?.value).toBe("2");
    });
    it("should not decrement below 1", () => {
      component.sendOptionsForm.patchValue({ maxAccessCount: "1" });
      component.decrementMaxAccessCount();
      expect(component.sendOptionsForm.get("maxAccessCount")?.value).toBe("1");
    });
  });
});
