import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils";

import { InlineEditComponent } from "./inline-edit.component";

describe("InlineEditComponent", () => {
  let component: InlineEditComponent;
  let fixture: ComponentFixture<InlineEditComponent>;
  let save: jest.Mock<Promise<boolean>, [string]>;

  // `start`, `submit`, `cancel` and `form` are protected; cast for testing.
  const internals = () =>
    component as unknown as {
      start: () => void;
      cancel: () => void;
      submit: () => Promise<void>;
      form: InlineEditComponent["form"];
    };

  // Open the editor and flush the effect that seeds the value and installs validators.
  const startEditing = () => {
    internals().start();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    save = jest.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [InlineEditComponent],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({
            inputRequired: "required",
            inputMaxLength: "too long",
            inputTrimValidator: "whitespace",
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InlineEditComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("value", "Initial");
    fixture.componentRef.setInput("label", "Name");
    fixture.componentRef.setInput("editLabel", "Edit");
    fixture.componentRef.setInput("saveLabel", "Save");
    fixture.componentRef.setInput("cancelLabel", "Cancel");
    fixture.componentRef.setInput("save", save);
    fixture.detectChanges();
  });

  it("shows the value but no edit affordance when canEdit is false", () => {
    fixture.componentRef.setInput("canEdit", false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Initial");
    expect(fixture.nativeElement.querySelector("button")).toBeNull();
  });

  it("closes the editor if edit permission is revoked mid-edit", () => {
    internals().start();
    expect(component.editing()).toBe(true);

    fixture.componentRef.setInput("canEdit", false);
    fixture.detectChanges();

    expect(component.editing()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain("Initial");
  });

  it("populates the form with the current value when editing starts", () => {
    startEditing();

    expect(component.editing()).toBe(true);
    expect(internals().form.controls.value.value).toBe("Initial");
  });

  it("does not save when the value is empty", async () => {
    startEditing();
    internals().form.controls.value.setValue("");

    await internals().submit();

    expect(save).not.toHaveBeenCalled();
    expect(component.editing()).toBe(true);
  });

  it("does not save when the value is only whitespace", async () => {
    startEditing();
    internals().form.controls.value.setValue("   ");

    await internals().submit();

    expect(save).not.toHaveBeenCalled();
    expect(component.editing()).toBe(true);
  });

  it("does not save when the value exceeds maxLength", async () => {
    fixture.componentRef.setInput("maxLength", 5);
    fixture.detectChanges();

    startEditing();
    internals().form.controls.value.setValue("too long");

    await internals().submit();

    expect(save).not.toHaveBeenCalled();
  });

  it("calls save with the entered value and closes the editor on success", async () => {
    startEditing();
    internals().form.controls.value.setValue("Renamed");

    await internals().submit();

    expect(save).toHaveBeenCalledWith("Renamed");
    expect(component.editing()).toBe(false);
  });

  it("keeps the editor open when save resolves false", async () => {
    save.mockResolvedValue(false);

    startEditing();
    internals().form.controls.value.setValue("Renamed");

    await internals().submit();

    expect(save).toHaveBeenCalledWith("Renamed");
    expect(component.editing()).toBe(true);
  });

  it("closes the editor on cancel", () => {
    startEditing();
    internals().cancel();

    expect(component.editing()).toBe(false);
  });

  it("seeds and validates the form when a parent opens the editor via the editing model", async () => {
    component.editing.set(true);
    fixture.detectChanges();

    expect(internals().form.controls.value.value).toBe("Initial");

    internals().form.controls.value.setValue("");
    await internals().submit();

    expect(save).not.toHaveBeenCalled();
  });

  it("shows the saved value in the display state after a successful save", async () => {
    startEditing();
    internals().form.controls.value.setValue("Renamed");

    await internals().submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Renamed");
  });
});
