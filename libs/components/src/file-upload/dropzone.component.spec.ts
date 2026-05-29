import { ComponentFixture, TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { DropzoneComponent } from "./dropzone.component";

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

  const dispatchInputChange = (input: HTMLInputElement, files: File[]) => {
    Object.defineProperty(input, "files", {
      configurable: true,
      value: files,
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const getLabel = () => fixture.nativeElement.querySelector("label") as HTMLLabelElement;
  const getInput = () =>
    fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
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
    fixture.detectChanges();
  });

  describe("file emission", () => {
    it("emits only the first file when multiple is false and several are dropped", () => {
      const emitSpy = jest.fn();
      component.filesSelected.subscribe(emitSpy);

      const fileA = makeFile("a.txt");
      const fileB = makeFile("b.txt");
      dispatchDragEvent(getLabel(), "drop", [fileA, fileB]);

      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith([fileA]);
    });

    it("emits all dropped files when multiple is true", () => {
      fixture.componentRef.setInput("multiple", true);
      fixture.detectChanges();

      const emitSpy = jest.fn();
      component.filesSelected.subscribe(emitSpy);

      const fileA = makeFile("a.txt");
      const fileB = makeFile("b.txt");
      dispatchDragEvent(getLabel(), "drop", [fileA, fileB]);

      expect(emitSpy).toHaveBeenCalledWith([fileA, fileB]);
    });

    it("emits a single file from the input change event when multiple is false", () => {
      const emitSpy = jest.fn();
      component.filesSelected.subscribe(emitSpy);

      const fileA = makeFile("a.txt");
      const fileB = makeFile("b.txt");
      dispatchInputChange(getInput(), [fileA, fileB]);

      expect(emitSpy).toHaveBeenCalledWith([fileA]);
    });

    it("clears the input value after a change so the same file can be re-selected", () => {
      const input = getInput();
      dispatchInputChange(input, [makeFile()]);

      expect(input.value).toBe("");
    });

    it("does not emit on drop with empty file list", () => {
      const emitSpy = jest.fn();
      component.filesSelected.subscribe(emitSpy);

      dispatchDragEvent(getLabel(), "drop", []);

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe("disabled", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("disabled", true);
      fixture.detectChanges();
    });

    it("does not emit when a file is dropped", () => {
      const emitSpy = jest.fn();
      component.filesSelected.subscribe(emitSpy);

      dispatchDragEvent(getLabel(), "drop", [makeFile()]);

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it("does not emit when the file input changes", () => {
      const emitSpy = jest.fn();
      component.filesSelected.subscribe(emitSpy);

      dispatchInputChange(getInput(), [makeFile()]);

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it("does not engage drag-over state on dragenter", () => {
      dispatchDragEvent(getLabel(), "dragenter");

      expect(isDragOver()).toBe(false);
    });
  });

  describe("drag state", () => {
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
  });
});
