/**
 * Result of reading files from a drag-and-drop event.
 * Shape matches the input to `SendFormComponent.zipBrowserFiles()`.
 */
export type DragDropResult = {
  files: Array<{ file: File; path: string }>;
  folderName: string | null;
};

/**
 * Process a `DataTransfer` from a drop event, recursively reading directories
 * via the `webkitGetAsEntry()` / `FileSystemDirectoryReader` APIs.
 *
 * Plain files are captured synchronously from `dataTransfer.files` to avoid
 * issues with the DataTransfer being cleared after the event handler returns.
 * Only directory traversal requires async operations via the entries API.
 */
export async function readDragDropEntries(dataTransfer: DataTransfer): Promise<DragDropResult> {
  const files: Array<{ file: File; path: string }> = [];
  let folderName: string | null = null;

  // Capture plain File objects synchronously — dataTransfer.files only
  // contains non-directory entries and is available during the event handler.
  const plainFiles = Array.from(dataTransfer.files);

  // Check for directories via the entries API (synchronous detection)
  const items = Array.from(dataTransfer.items);
  const directoryEntries: FileSystemDirectoryEntry[] = [];

  for (const item of items) {
    if (item.kind !== "file") {
      continue;
    }
    const entry = item.webkitGetAsEntry?.();
    if (entry?.isDirectory) {
      directoryEntries.push(entry as FileSystemDirectoryEntry);
    }
  }

  // If there are directories, only add files that aren't the directory entries
  // (dataTransfer.files may include a 0-byte placeholder for directories in some browsers)
  if (directoryEntries.length > 0) {
    const dirNames = new Set(directoryEntries.map((d) => d.name));
    for (const file of plainFiles) {
      if (!dirNames.has(file.name) || file.size > 0) {
        files.push({ file, path: file.name });
      }
    }

    // Recursively read directory contents (async)
    for (const dirEntry of directoryEntries) {
      folderName = dirEntry.name;
      const dirFiles = await readDirectoryEntry(dirEntry, dirEntry.name);
      files.push(...dirFiles);
    }
  } else {
    // No directories — just use the plain files
    for (const file of plainFiles) {
      files.push({ file, path: file.name });
    }
  }

  return { files, folderName };
}

/**
 * Recursively read all files in a directory entry.
 */
async function readDirectoryEntry(
  dirEntry: FileSystemDirectoryEntry,
  basePath: string,
): Promise<Array<{ file: File; path: string }>> {
  const results: Array<{ file: File; path: string }> = [];
  const reader = dirEntry.createReader();

  let batch: FileSystemEntry[];
  do {
    batch = await readEntries(reader);
    for (const entry of batch) {
      const entryPath = `${basePath}/${entry.name}`;
      if (entry.isDirectory) {
        const subFiles = await readDirectoryEntry(entry as FileSystemDirectoryEntry, entryPath);
        results.push(...subFiles);
      } else {
        const file = await fileEntryToFile(entry as FileSystemFileEntry);
        results.push({ file, path: entryPath });
      }
    }
  } while (batch.length > 0);

  return results;
}

/**
 * Promisified wrapper around `FileSystemDirectoryReader.readEntries()`.
 * Must be called repeatedly until it returns an empty array.
 */
function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(
      (entries) => resolve(entries),
      (err) => reject(err),
    );
  });
}

/**
 * Convert a `FileSystemFileEntry` to a `File`.
 */
function fileEntryToFile(fileEntry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    fileEntry.file(
      (file) => resolve(file),
      (err) => reject(err),
    );
  });
}
