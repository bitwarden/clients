/**
 * Abstract service for reading files and directories from the native filesystem.
 * Used by the send form to read pre-loaded paths from the desktop context menu.
 *
 * Desktop implementation uses IPC to call Rust NAPI bindings.
 * Web/Browser implementations should throw (not supported).
 */
export abstract class SendFileProviderService {
  /**
   * Read a single file's contents from the given filesystem path.
   */
  abstract readFile(path: string): Promise<Uint8Array>;

  /**
   * Recursively read all files in a directory.
   * Returns entries with relative paths and raw contents.
   */
  abstract readDirectory(path: string): Promise<{ relativePath: string; contents: number[] }[]>;
}
