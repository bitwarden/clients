import { ClipperzHtmlImporter } from "./clipperz-html-importer";

/**
 * Clipperz exports are XHTML documents carrying a PUBLIC DOCTYPE, with the vault itself stored as
 * JSON inside a single textarea. That DOCTYPE is why the XXE guard originally carved out PUBLIC
 * identifiers; this importer parses as HTML instead, so the carve-out is no longer needed and the
 * guard can reject both forms of external DTD reference.
 */
function clipperzExport(entries: unknown): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://dtd.example.com/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <textarea>${JSON.stringify(entries)}</textarea>
  </body>
</html>`;
}

describe("ClipperzHtmlImporter", () => {
  let importer: ClipperzHtmlImporter;

  beforeEach(() => {
    importer = new ClipperzHtmlImporter();
  });

  it("imports an export whose XHTML DOCTYPE carries a PUBLIC identifier", async () => {
    const data = clipperzExport([
      {
        label: "GitHub",
        currentVersion: {
          fields: {
            "0": { label: "username", actionType: "username", value: "user@example.com" },
            "1": { label: "password", actionType: "password", value: "hunter2" },
            "2": { label: "url", actionType: "url", value: "https://github.com" },
          },
        },
      },
    ]);

    const result = await importer.parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers.length).toBe(1);
    expect(result.ciphers[0].name).toBe("GitHub");
    expect(result.ciphers[0].login.username).toBe("user@example.com");
    expect(result.ciphers[0].login.password).toBe("hunter2");
    expect(result.ciphers[0].login.uris[0].uri).toBe("https://github.com");
  });

  it("preserves notes", async () => {
    const data = clipperzExport([{ label: "Note", data: { notes: "line one\\nline two" } }]);

    const result = await importer.parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers[0].notes).toBe("line one\nline two");
  });

  // HTML parsing never resolves DTDs or entities, so an export carrying an external DTD reference
  // and an entity reference yields the literal text rather than a fetch or an expansion.
  it("does not resolve entities declared via an external DTD", async () => {
    const data = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://dtd.example.com/evil.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <textarea>[{"label":"&xxe;"}]</textarea>
  </body>
</html>`;

    const result = await importer.parse(data);

    expect(result.success).toBe(true);
    expect(result.ciphers[0].name).toBe("&xxe;");
  });

  it("fails when the textarea is missing", async () => {
    const data = `<!DOCTYPE html><html><body></body></html>`;

    const result = await importer.parse(data);

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Missing textarea.");
  });
});
