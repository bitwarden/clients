// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { OffscreenDocumentService } from "./abstractions/offscreen-document";

export class DefaultOffscreenDocumentService implements OffscreenDocumentService {
  private workerCount = 0;

  constructor(private logService: LogService) {}

  offscreenApiSupported(): boolean {
    return typeof chrome.offscreen !== "undefined";
  }

  async withDocument<T>(
    reasons: chrome.offscreen.Reason[],
    justification: string,
    callback: () => Promise<T> | T,
  ): Promise<T> {
    this.workerCount++;
    try {
      if (!(await this.documentExists())) {
        await this.create(reasons, justification);
      }

      return await callback();
    } finally {
      this.workerCount--;
      if (this.workerCount === 0) {
        await this.close();
      }
    }
  }

  private async create(reasons: chrome.offscreen.Reason[], justification: string): Promise<void> {
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen-document/index.html",
        reasons,
        justification,
      });
    } catch (e) {
      // gobble multiple offscreen document creation errors
      // TODO: remove this when the offscreen document service is fixed PM-8014
      if (e.message === "Only a single offscreen document may be created.") {
        this.logService.info("Ignoring offscreen document creation error.");
        return;
      }
      throw e;
    }
  }

  private async close(): Promise<void> {
    await chrome.offscreen.closeDocument();
  }

  private async documentExists(): Promise<boolean> {
    return await chrome.offscreen.hasDocument();
  }
}
