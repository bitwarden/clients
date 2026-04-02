import { booleanAttribute, ChangeDetectionStrategy, Component, input, model } from "@angular/core";

import { DropzoneComponent } from "./dropzone.component";
import { FileListComponent } from "./file-list.component";

@Component({
  selector: "bit-file-upload",
  templateUrl: "./file-upload.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DropzoneComponent, FileListComponent],
  host: {
    class: "tw-block",
  },
})
export class FileUploadComponent {
  /** Accepted file types (e.g. ".png,.jpg,.svg") */
  readonly accept = input("");

  /** Maximum file size in MB */
  readonly maxFileSize = input.required<number>();

  /** Allow multiple file selection */
  readonly multiple = input(false, { transform: booleanAttribute });

  /** Error state — shows danger border on the dropzone */
  readonly hasError = input(false, { transform: booleanAttribute });

  /** Two-way bound file list — use [(files)] for two-way binding */
  readonly files = model<File[]>([]);

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
}
