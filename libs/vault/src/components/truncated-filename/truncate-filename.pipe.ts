import { Pipe, PipeTransform } from "@angular/core";

import { truncateFilename } from "./truncate-filename";

/**
 * Angular pipe that truncates a filename in the middle, preserving the file extension.
 *
 * @example
 *   {{ attachment.fileName | truncateFilename }}
 *   {{ attachment.fileName | truncateFilename: 40 }}
 */
@Pipe({ name: "truncateFilename", standalone: true, pure: true })
export class TruncateFilenamePipe implements PipeTransform {
  transform(filename: string | null | undefined, maxLength?: number): string {
    if (!filename) {
      return "";
    }
    return truncateFilename(filename, maxLength);
  }
}
