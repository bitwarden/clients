/**
 * Truncates a filename in the middle, preserving the file extension.
 *
 * When the filename exceeds `maxLength`, it splits the name into a start portion
 * and an end portion (including the full extension), joined by an ellipsis ("...").
 *
 * For very long extensions that consume most of the available space, the start
 * portion is minimized to show as much of the extension as possible.
 *
 * @example
 *   truncateFilename("very-long-document-name.pdf", 25)
 *   // => "very-long-do...t-name.pdf"
 *
 *   truncateFilename("short.pdf", 25)
 *   // => "short.pdf"
 *
 *   truncateFilename("file.extremely-long-extension", 25)
 *   // => "f...xtremely-long-extension"
 */
export function truncateFilename(filename: string, maxLength: number = 30): string {
  if (!filename || filename.length <= maxLength) {
    return filename ?? "";
  }

  const ellipsis = "\u2026";
  const availableChars = maxLength - 1; // 1 char for ellipsis

  // Find the last dot to split base name and extension
  const lastDotIndex = filename.lastIndexOf(".");
  const hasExtension = lastDotIndex > 0;

  if (!hasExtension) {
    // No extension: split in the middle
    const startLength = Math.ceil(availableChars / 2);
    const endLength = availableChars - startLength;
    return filename.slice(0, startLength) + ellipsis + filename.slice(filename.length - endLength);
  }

  const extension = filename.slice(lastDotIndex); // includes the dot
  const baseName = filename.slice(0, lastDotIndex);

  // If the extension alone is too long, show minimal base + as much extension as possible
  if (extension.length >= availableChars) {
    return baseName.slice(0, 1) + ellipsis + extension.slice(-(availableChars - 1));
  }

  // Normal case: allocate remaining space to start and end of the base name
  const charsForBase = availableChars - extension.length;
  const startLength = Math.ceil(charsForBase / 2);
  const endLength = charsForBase - startLength;

  const start = baseName.slice(0, startLength);
  const end = endLength > 0 ? baseName.slice(baseName.length - endLength) : "";

  return start + ellipsis + end + extension;
}
