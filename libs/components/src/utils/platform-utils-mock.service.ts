import { Injectable } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

// mock based on web-platform-utils.service.ts
@Injectable()
export class MockPlatformUtilsService implements Partial<PlatformUtilsService> {
  copyToClipboard(text: string, options?: any): void | boolean {
    let win = window;
    let doc = window.document;
    if (options && (options.window || options.win)) {
      win = options.window || options.win;
      doc = win.document;
    } else if (options && options.doc) {
      doc = options.doc;
    }
    if (doc.queryCommandSupported && doc.queryCommandSupported("copy")) {
      const textarea = doc.createElement("textarea");
      textarea.textContent = text;
      // Prevent scrolling to bottom of page in MS Edge.
      textarea.style.position = "fixed";
      let copyEl = doc.body;
      // For some reason copy command won't work when modal is open if appending to body
      if (doc.body.classList.contains("modal-open")) {
        copyEl = doc.body.querySelector<HTMLElement>(".modal")!;
      }
      copyEl.appendChild(textarea);
      textarea.select();
      let success = false;
      try {
        // Security exception may be thrown by some browsers.
        success = doc.execCommand("copy");
        if (!success) {
          // eslint-disable-next-line
          console.debug("Copy command unsupported or disabled.");
        }
      } catch (e) {
        // eslint-disable-next-line
        console.warn("Copy to clipboard failed.", e);
      } finally {
        copyEl.removeChild(textarea);
      }
      return success;
    }
  }
}
