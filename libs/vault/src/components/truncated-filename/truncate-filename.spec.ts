import { truncateFilename } from "./truncate-filename";

describe("truncateFilename", () => {
  it("returns the filename unchanged when shorter than maxLength", () => {
    expect(truncateFilename("short.pdf", 30)).toBe("short.pdf");
  });

  it("returns the filename unchanged when exactly at maxLength", () => {
    // "a" repeated 26 times + ".pdf" = 30 chars
    const name = "a".repeat(26) + ".pdf";
    expect(truncateFilename(name, 30)).toBe(name);
  });

  it("truncates a long filename with a short extension", () => {
    const result = truncateFilename("this-is-a-very-long-document-name.pdf", 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).toContain("\u2026");
    expect(result).toContain(".pdf");
  });

  it("preserves the file extension", () => {
    const result = truncateFilename("my-important-document-with-a-long-name.docx", 25);
    expect(result).toMatch(/\.docx$/);
    expect(result).toContain("\u2026");
  });

  it("handles filenames with no extension", () => {
    const result = truncateFilename("a-very-long-filename-without-any-extension", 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).toContain("\u2026");
  });

  it("handles filenames with multiple dots", () => {
    const result = truncateFilename("my-archive-backup-2024-01-15.tar.gz", 20);
    expect(result.length).toBeLessThanOrEqual(20);
    // Should preserve the last extension (.gz)
    expect(result).toMatch(/\.gz$/);
  });

  it("handles a very long custom extension", () => {
    const result = truncateFilename("file.extremely-long-custom-extension", 25);
    expect(result.length).toBeLessThanOrEqual(25);
    expect(result).toContain("\u2026");
    // Should start with at least the first character of the base name
    expect(result[0]).toBe("f");
  });

  it("returns empty string for null input", () => {
    expect(truncateFilename(null as unknown as string, 30)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(truncateFilename(undefined as unknown as string, 30)).toBe("");
  });

  it("returns empty string for empty string input", () => {
    expect(truncateFilename("", 30)).toBe("");
  });

  it("handles a filename that is just an extension", () => {
    expect(truncateFilename(".gitignore", 30)).toBe(".gitignore");
  });

  it("handles a filename starting with a dot that needs truncation", () => {
    const result = truncateFilename(".a-very-long-hidden-file-name-in-unix", 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result).toContain("\u2026");
  });

  it("uses default maxLength of 30", () => {
    const longName = "a".repeat(40) + ".txt";
    const result = truncateFilename(longName);
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it("shows start and end of base name with extension", () => {
    // With a predictable input, verify the structure
    const result = truncateFilename("abcdefghijklmnopqrstuvwxyz.pdf", 15);
    expect(result).toContain("\u2026");
    expect(result).toMatch(/\.pdf$/);
    // Should start with some characters from the beginning
    expect(result).toMatch(/^abcde/);
  });
});
