import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChildren,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";
import { IconTileComponent } from "../icon-tile/icon-tile.component";

import { FileNameComponent } from "./file-name.component";

let nextId = 0;

@Component({
  selector: "bit-file-list",
  templateUrl: "./file-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BitIconButtonComponent, IconTileComponent, I18nPipe, FileNameComponent],
  host: {
    class: "tw-block",
  },
})
export class FileListComponent {
  protected readonly labelId = `bit-file-list-${nextId++}-label`;

  /** Files to display in the list */
  readonly files = input<File[]>([]);

  /** When true, hides the delete buttons */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Emits the file when its delete button is clicked */
  readonly fileRemoved = output<File>();

  private readonly deleteButtons = viewChildren("deleteBtn", { read: ElementRef });

  /** Focus the delete button at the given index, if it exists. */
  focusDeleteAt(index: number): void {
    const element = this.deleteButtons()[index]?.nativeElement as HTMLButtonElement | undefined;
    element?.focus();
  }

  protected formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = bytes / Math.pow(k, i);

    return `${Number.isInteger(size) ? size : size.toFixed(1)} ${units[i]}`;
  }
}
