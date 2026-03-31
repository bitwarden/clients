import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";
import { IconTileComponent } from "../icon-tile/icon-tile.component";

@Component({
  selector: "bit-file-list",
  templateUrl: "./file-list.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BitIconButtonComponent, IconTileComponent, I18nPipe],
  host: {
    class: "tw-block",
  },
})
export class FileListComponent {
  /** Files to display in the list */
  readonly files = input<File[]>([]);

  /** Emits the file when its delete button is clicked */
  readonly fileRemoved = output<File>();

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
