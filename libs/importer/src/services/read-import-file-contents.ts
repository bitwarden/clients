import * as JSZip from "jszip";

import { ImportType } from "../models/import-options";

/** A few formats' exports aren't plain text — extracts the real payload, per format. */
export async function readImportFileContents(format: ImportType, file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (format === "1password1pux" && name.endsWith(".1pux")) {
    return extractZipContent(file, "export.data");
  }
  if (
    format === "protonpass" &&
    (file.type === "application/zip" ||
      file.type === "application/x-zip-compressed" ||
      name.endsWith(".zip"))
  ) {
    return extractZipContent(file, "Proton Pass/data.json");
  }

  const text = await readFileAsText(file);
  if (format === "lastpasscsv" && (file.type === "text/html" || name.endsWith(".html"))) {
    return extractLastPassHtmlContent(text);
  }
  return text;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file, "utf-8");
    reader.onload = (evt) => {
      resolve((evt.target as any).result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("FileReader error reading file"));
    };
  });
}

function extractLastPassHtmlContent(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const pre = doc.querySelector("pre");
  if (pre == null) {
    throw new Error("LastPass html export has no <pre> content");
  }
  return pre.textContent;
}

async function extractZipContent(zipFile: File, contentFilePath: string): Promise<string> {
  const zip = await new JSZip().loadAsync(zipFile);
  const entry = zip.file(contentFilePath);
  if (entry == null) {
    throw new Error(`Zip entry not found: ${contentFilePath}`);
  }
  return entry.async("string");
}
