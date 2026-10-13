import * as path from "path";

/**
 * Validates that a request URL targets the expected custom protocol host and resolves
 * to a path safely contained within the base directory (no directory traversal).
 * @returns The safe absolute path to serve, or `null` if validation fails
 */
export function resolveProtocolPath(
  requestUrl: string,
  expectedHost: string,
  baseDir: string,
): string | null {
  const url = new URL(requestUrl);
  let pathname = url.pathname;

  // Only serve files when the host matches our expected bundle host
  if (url.host !== expectedHost) {
    return null;
  }

  // Trim the starting slash if it exists to prevent issues with path resolution
  if (pathname.startsWith("/")) {
    pathname = pathname.slice(1);
  }

  // Default to index.html if no pathname is provided
  if (pathname === "") {
    pathname = "index.html";
  }

  const resolvedPath = path.resolve(baseDir, pathname);
  const relativePath = path.relative(baseDir, resolvedPath);

  // Ensure the resolved path stays within baseDir:
  // - `relativePath` must be non-empty (not baseDir itself)
  // - must not start with ".." (directory traversal)
  // - must not be absolute (e.g. start with / or a Windows drive path like C:\)
  const isSafe = relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);

  if (!isSafe) {
    return null;
  }

  // Reconstruct the path from the validated relative path
  return path.join(baseDir, relativePath);
}
