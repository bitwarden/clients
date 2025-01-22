// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import * as papa from "papaparse";

import { EventView } from "@bitwarden/common/models/view/event.view";

import { EventExport } from "./event.export";

@Injectable({
  providedIn: "root",
})
export class EventExportService {
  async getEventExport(events: EventView[]): Promise<string> {
    return papa.unparse(events.map((e) => new EventExport(e)));
  }

  getFileName(prefix: string = null, extension = "csv"): string {
    const now = new Date();
    const dateString =
      now.getFullYear() +
      "" +
      this.padNumber(now.getMonth() + 1, 2) +
      "" +
      this.padNumber(now.getDate(), 2) +
      this.padNumber(now.getHours(), 2) +
      "" +
      this.padNumber(now.getMinutes(), 2) +
      this.padNumber(now.getSeconds(), 2);

    return "bitwarden" + (prefix ? "_" + prefix : "") + "_export_" + dateString + "." + extension;
  }

  private padNumber(num: number, width: number, padCharacter = "0"): string {
    const numString = num.toString();
    return numString.length >= width
      ? numString
      : new Array(width - numString.length + 1).join(padCharacter) + numString;
  }
}
