import * as papa from "papaparse";

import { FlightRecorderEvent } from "@bitwarden/sdk-internal";

const CSV_COLUMNS = ["timestamp", "level", "target", "message", "fields"] as const;

/**
 * Build a CSV download payload for {@link FlightRecorderEvent}s.
 *
 * Returns a `fileName` of the form `Bitwarden-diagnostic-report-YYYY-MM-DD.csv`
 * and a CSV-encoded `blobData` ready to pass to `FileDownloadService.download`.
 *
 * @param events The events to encode.
 * @param date The date used for the filename. Defaults to `new Date()`.
 */
export function buildFlightRecorderCsvExport(
  events: FlightRecorderEvent[],
  date: Date = new Date(),
): { fileName: string; blobData: string } {
  const rows = events.map((e) => ({
    timestamp: new Date(e.timestamp).toISOString(),
    level: e.level,
    target: e.target,
    message: e.message,
    fields: JSON.stringify(e.fields),
  }));

  const blobData = papa.unparse(rows, {
    columns: [...CSV_COLUMNS],
    header: true,
  });

  const datePart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const fileName = `Bitwarden-diagnostic-report-${datePart}.csv`;

  return { fileName, blobData };
}
