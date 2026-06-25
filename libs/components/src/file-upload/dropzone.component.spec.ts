import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { DropzoneComponent } from "./dropzone.component";

// DropzoneComponent is an internal helper of FileUploadComponent; most behavior is
// exercised at the public boundary in file-upload.component.spec.ts. This file covers
// only the drag-depth state machine, which is hard to assert from the public surface.
describe("DropzoneComponent", () => {
  let fixture: ComponentFixture<DropzoneComponent>;
  let component: DropzoneComponent;

  const makeFile = (name = "a.txt") => new File(["x"], name);

  const dispatchDragEvent = (target: Element, type: string, files: File[] = []) => {
    const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, "dataTransfer", {
      value: { files },
    });
    target.dispatchEvent(event);
    return event;
  };

  const getLabel = () => fixture.nativeElement.querySelector("label") as HTMLLabelElement;
  // isDragOver is protected; reading it directly from the instance is more stable
  // than asserting against rendered Tailwind class names.
  const isDragOver = () => (component as unknown as { isDragOver: () => boolean }).isDragOver();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DropzoneComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              clickToUploadOrDragAndDrop: "Click to upload or drag and drop",
              chooseFiles: "Choose files",
              maxFileSizeParam: "Max. File Size: __$1__MB",
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DropzoneComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("inputId", "test-dropzone-input");
    fixture.detectChanges();
  });

  it("stays in drag-over state while nested children re-enter the parent", () => {
    const label = getLabel();

    // Parent dragenter, then dragenter on a nested child element bubbles up again.
    dispatchDragEvent(label, "dragenter");
    dispatchDragEvent(label, "dragenter");
    expect(isDragOver()).toBe(true);

    // One dragleave (leaving the child) should NOT reset the state.
    dispatchDragEvent(label, "dragleave");
    expect(isDragOver()).toBe(true);

    // Second dragleave (leaving the parent) resets it.
    dispatchDragEvent(label, "dragleave");
    expect(isDragOver()).toBe(false);
  });

  it("resets drag-over state immediately on drop", () => {
    const label = getLabel();

    dispatchDragEvent(label, "dragenter");
    dispatchDragEvent(label, "dragenter");
    dispatchDragEvent(label, "drop", [makeFile()]);

    expect(isDragOver()).toBe(false);
  });

  it("does not engage drag-over state on dragenter when disabled", () => {
    fixture.componentRef.setInput("disabled", true);
    fixture.detectChanges();

    dispatchDragEvent(getLabel(), "dragenter");

    expect(isDragOver()).toBe(false);
  });
});
