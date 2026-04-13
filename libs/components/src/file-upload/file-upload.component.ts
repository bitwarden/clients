import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitFieldContainerDirective } from "../form-field";
import { BitErrorComponent } from "../form-field/error.component";

import { DropzoneComponent } from "./dropzone.component";
import { FileListComponent } from "./file-list.component";

let nextId = 0;

@Component({
  selector: "bit-file-upload",
  templateUrl: "./file-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DropzoneComponent,
    FileListComponent,
    BitFieldContainerDirective,
    I18nPipe,
    BitErrorComponent,
  ],
  host: {
    class: "tw-block",
  },
})
export class FileUploadComponent {
  /**
   * Accepted file types. Uses comma separated list
   *
   * @example
   * Images only: "image/*"
   * PDF and Word docs: ".pdf,.doc,.docx"
   * Specific audio formats: "audio/mpeg,audio/wav"
   * Mixed types: "image/*,.pdf"
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept#unique_file_type_specifiers
   *
   * NOTE: This is only a user hint. Not a validation
   **/
  readonly accept = input("");

  /**
   * Maximum file size in MB
   *
   * NOTE: This is only a user hint. Not a validation
   **/
  readonly maxFileSize = input<number | undefined>(undefined);

  /**
   * Allow multiple file selection
   *
   * NOTE: If `multiple="true"` it will render the 'dropzone' version of the component
   */
  readonly multiple = input(false, { transform: booleanAttribute });

  /** Error state — shows danger border and message */
  readonly errorMessage = input<string>(undefined);

  /**
   * Two-way bound file list — use [(files)] for two-way binding
   *
   * NOTE: File list only renders in the dropzone variant usage
   */
  readonly files = model<File[]>([]);

  /** UI variant: 'dropzone' or 'default' */
  readonly variant = input<"dropzone" | "default">("default");

  protected readonly inputId = `bit-file-upload-${nextId++}`;

  protected readonly fileLabel = computed(() => {
    const files = this.files();
    if (files.length) {
      return files.length === 1 ? files[0].name : `${files.length} files selected`;
    }
  });

  protected onFilesSelected(newFiles: File[]): void {
    if (this.multiple()) {
      this.files.update((current) => [...current, ...newFiles]);
    } else {
      this.files.set(newFiles.length > 0 ? [newFiles[0]] : []);
    }
  }

  protected onFileRemoved(file: File): void {
    this.files.update((current) => current.filter((f) => f !== file));
  }

  protected onButtonFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files?.length) {
      this.onFilesSelected(Array.from(input.files));
      input.value = ""; // allow re-selecting same file
    }
  }
}
