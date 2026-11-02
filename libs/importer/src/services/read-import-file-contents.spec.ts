import * as JSZip from "jszip";

import { readImportFileContents } from "./read-import-file-contents";

async function zipFile(name: string, type: string, entries: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], name, { type });
}

describe("readImportFileContents", () => {
  it("reads a plain text file as-is", async () => {
    const file = new File(["hello,world"], "export.csv", { type: "text/csv" });

    await expect(readImportFileContents("bitwardencsv", file)).resolves.toBe("hello,world");
  });

  it("extracts the <pre> content from a LastPass html export", async () => {
    const file = new File(
      ["<html><body><pre>url,username,password</pre></body></html>"],
      "export.html",
      {
        type: "text/html",
      },
    );

    await expect(readImportFileContents("lastpasscsv", file)).resolves.toBe(
      "url,username,password",
    );
  });

  it("rejects a LastPass html export with no <pre> content", async () => {
    const file = new File(["<html><body>no data here</body></html>"], "export.html", {
      type: "text/html",
    });

    await expect(readImportFileContents("lastpasscsv", file)).rejects.toThrow(
      "LastPass html export has no <pre> content",
    );
  });

  it("extracts the <pre> content from a LastPass html export even when the platform reports no MIME type", async () => {
    // Admission goes by extension, so extraction can't depend solely on the platform's MIME type.
    const file = new File(
      ["<html><body><pre>url,username,password</pre></body></html>"],
      "export.html",
      { type: "" },
    );

    await expect(readImportFileContents("lastpasscsv", file)).resolves.toBe(
      "url,username,password",
    );
  });

  it("extracts the <pre> content from a LastPass html export with an uppercase extension and no MIME type", async () => {
    // The admitting component lowercases the extension before matching, so this must too.
    const file = new File(
      ["<html><body><pre>url,username,password</pre></body></html>"],
      "Export.HTML",
      { type: "" },
    );

    await expect(readImportFileContents("lastpasscsv", file)).resolves.toBe(
      "url,username,password",
    );
  });

  it("does not apply LastPass html extraction to a plain csv file", async () => {
    const file = new File(["url,username,password"], "export.csv", { type: "text/csv" });

    await expect(readImportFileContents("lastpasscsv", file)).resolves.toBe(
      "url,username,password",
    );
  });

  it("extracts export.data from a 1Password .1pux export", async () => {
    const file = await zipFile("export.1pux", "application/octet-stream", {
      "export.data": '{"accounts":[]}',
    });

    await expect(readImportFileContents("1password1pux", file)).resolves.toBe('{"accounts":[]}');
  });

  it("extracts Proton Pass/data.json from a ProtonPass .zip export", async () => {
    const file = await zipFile("export.zip", "application/zip", {
      "Proton Pass/data.json": '{"items":[]}',
    });

    await expect(readImportFileContents("protonpass", file)).resolves.toBe('{"items":[]}');
  });

  it("extracts Proton Pass/data.json from a ProtonPass export with an uppercase .ZIP extension and no MIME type", async () => {
    const zip = new JSZip();
    zip.file("Proton Pass/data.json", '{"items":[]}');
    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "Export.ZIP", { type: "" });

    await expect(readImportFileContents("protonpass", file)).resolves.toBe('{"items":[]}');
  });

  it("rejects when the expected zip entry is missing", async () => {
    const file = await zipFile("export.zip", "application/zip", {
      "unexpected.json": "{}",
    });

    await expect(readImportFileContents("protonpass", file)).rejects.toThrow(
      "Zip entry not found: Proton Pass/data.json",
    );
  });

  it("rejects when the file isn't a valid zip at all", async () => {
    const file = new File(["not a zip"], "export.zip", { type: "application/zip" });

    await expect(readImportFileContents("protonpass", file)).rejects.toThrow(
      "Can't find end of central directory",
    );
  });

  it("rejects when the FileReader itself errors out", async () => {
    const realFileReader = globalThis.FileReader;
    class FailingFileReader {
      onerror: (() => void) | null = null;
      error = new Error("permission denied");
      readAsText(): void {
        queueMicrotask(() => this.onerror?.());
      }
    }
    (globalThis as any).FileReader = FailingFileReader;

    try {
      const file = new File(["hello,world"], "export.csv", { type: "text/csv" });
      await expect(readImportFileContents("bitwardencsv", file)).rejects.toThrow(
        "permission denied",
      );
    } finally {
      globalThis.FileReader = realFileReader;
    }
  });
});
