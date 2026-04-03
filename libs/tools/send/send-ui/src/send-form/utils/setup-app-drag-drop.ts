import { DragDropResult, readDragDropEntries } from "./drag-drop-entries";

/**
 * Registers drag-and-drop event listeners on `document.body` for app-level
 * file drop support. Handles enter/leave counting to prevent flicker,
 * calls `preventDefault()` on dragover to allow drops, and reads dropped
 * files via the entries API.
 *
 * @param onDragActive Called when the drag-active state changes (true when files are being dragged over)
 * @param onFilesDropped Called with the dropped files result
 */
export function setupAppDragDrop(
  onDragActive: (active: boolean) => void,
  onFilesDropped: (result: DragDropResult) => void,
): void {
  let enterCount = 0;
  const el = document.body;

  el.addEventListener("dragenter", (e: DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) {
      return;
    }
    e.preventDefault();
    enterCount++;
    if (enterCount === 1) {
      onDragActive(true);
    }
  });

  el.addEventListener("dragover", (e: DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) {
      return;
    }
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  });

  el.addEventListener("dragleave", (e: DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) {
      return;
    }
    enterCount--;
    if (enterCount <= 0) {
      enterCount = 0;
      onDragActive(false);
    }
  });

  el.addEventListener("drop", (e: DragEvent) => {
    e.preventDefault();
    enterCount = 0;
    onDragActive(false);

    if (!e.dataTransfer || !Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) {
      return;
    }

    readDragDropEntries(e.dataTransfer)
      .then((result) => {
        if (result.files.length > 0) {
          onFilesDropped(result);
        }
      })
      .catch(() => {
        // Silently ignore — file reading can fail if DataTransfer is cleared
      });
  });
}
