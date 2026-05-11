import * as papa from "papaparse";

import { FlightRecorderEvent } from "@bitwarden/sdk-internal";

import { buildFlightRecorderCsvExport } from "./flight-recorder-export";

describe("buildFlightRecorderCsvExport", () => {
  describe("fileName", () => {
    it("uses the Bitwarden-diagnostic-report-YYYY-MM-DD.csv format", () => {
      const date = new Date(2026, 4, 4); // 2026-05-04 local time

      const { fileName } = buildFlightRecorderCsvExport([], date);

      expect(fileName).toBe("Bitwarden-diagnostic-report-2026-05-04.csv");
    });

    it("zero-pads single-digit months and days", () => {
      const date = new Date(2026, 0, 5); // January 5

      const { fileName } = buildFlightRecorderCsvExport([], date);

      expect(fileName).toBe("Bitwarden-diagnostic-report-2026-01-05.csv");
    });

    it("defaults to the current date when none is supplied", () => {
      const fixed = new Date(2026, 5, 15);
      jest.useFakeTimers().setSystemTime(fixed);

      try {
        const { fileName } = buildFlightRecorderCsvExport([]);

        expect(fileName).toBe("Bitwarden-diagnostic-report-2026-06-15.csv");
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("blobData", () => {
    const sampleEvent: FlightRecorderEvent = {
      timestamp: 1000,
      level: "INFO",
      target: "bitwarden_core::client",
      message: "Client initialized",
      fields: {},
    };

    it("emits the documented header row in column order", () => {
      const { blobData } = buildFlightRecorderCsvExport([sampleEvent], new Date(2026, 0, 1));

      const [header] = blobData.split(/\r?\n/);
      expect(header).toBe("timestamp,level,target,message,fields");
    });

    it("returns an empty string for an empty events array", () => {
      const { blobData } = buildFlightRecorderCsvExport([], new Date(2026, 0, 1));

      expect(blobData).toBe("");
    });

    it("converts numeric timestamps to ISO-8601 strings", () => {
      const events: FlightRecorderEvent[] = [{ ...sampleEvent, timestamp: 0 }];

      const { blobData } = buildFlightRecorderCsvExport(events, new Date(2026, 0, 1));
      const [, row] = papa.parse<string[]>(blobData).data;

      expect(row[0]).toBe("1970-01-01T00:00:00.000Z");
    });

    it("serializes the fields object with JSON.stringify, including the empty object", () => {
      const events: FlightRecorderEvent[] = [
        { ...sampleEvent, message: "no fields", fields: {} },
        {
          ...sampleEvent,
          timestamp: 2000,
          message: "with fields",
          fields: { user: "abc", count: "3" },
        },
      ];

      const { blobData } = buildFlightRecorderCsvExport(events, new Date(2026, 0, 1));
      const [, emptyRow, populatedRow] = papa.parse<string[]>(blobData).data;

      expect(emptyRow[4]).toBe("{}");
      expect(JSON.parse(populatedRow[4])).toEqual({ user: "abc", count: "3" });
    });

    it("preserves the column order across all rows", () => {
      const events: FlightRecorderEvent[] = [
        {
          timestamp: 1000,
          level: "INFO",
          target: "target.a",
          message: "msg-a",
          fields: { k: "v" },
        },
      ];

      const { blobData } = buildFlightRecorderCsvExport(events, new Date(2026, 0, 1));
      const [, row] = papa.parse<string[]>(blobData).data;

      expect(row[0]).toBe("1970-01-01T00:00:01.000Z");
      expect(row[1]).toBe("INFO");
      expect(row[2]).toBe("target.a");
      expect(row[3]).toBe("msg-a");
      expect(JSON.parse(row[4])).toEqual({ k: "v" });
    });
  });
});
