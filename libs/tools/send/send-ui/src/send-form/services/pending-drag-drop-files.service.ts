import { Injectable } from "@angular/core";

/**
 * Holds File objects from drag-and-drop that have not yet been handed
 * to the Send creation dialog. Used by app-level drop zones to pass
 * dropped files to the Send page after navigation.
 */
@Injectable({ providedIn: "root" })
export class PendingDragDropFilesService {
  private files: Array<{ file: File; path: string }> | null = null;
  private folderName: string | null = null;

  setFiles(files: Array<{ file: File; path: string }>, folderName: string | null): void {
    this.files = files;
    this.folderName = folderName;
  }

  takeFiles(): { files: Array<{ file: File; path: string }>; folderName: string | null } | null {
    if (this.files == null) {
      return null;
    }
    const result = { files: this.files, folderName: this.folderName };
    this.files = null;
    this.folderName = null;
    return result;
  }

  hasPending(): boolean {
    return this.files != null && this.files.length > 0;
  }
}
