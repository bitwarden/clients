import { FilelessImportPort } from "../enums/fileless-import.enums";

import {
  LpFilelessImporter as LpFilelessImporterInterface,
  LpFilelessImporterMessage,
  LpFilelessImporterMessageHandlers,
} from "./abstractions/lp-fileless-importer";

class LpFilelessImporter implements LpFilelessImporterInterface {
  private exportData: string;
  private messagePort: chrome.runtime.Port;
  private mutationObserver: MutationObserver;
  private readonly portMessageHandlers: LpFilelessImporterMessageHandlers = {
    verifyFeatureFlag: ({ message }) => this.handleFeatureFlagVerification(message),
    triggerCsvDownload: () => this.triggerCsvDownload(),
    startLpFilelessImport: () => this.startLpImport(),
  };

  /**
   * Initializes the LP fileless importer.
   */
  init() {
    this.setupMessagePort();
  }

  /**
   * Enacts behavior based on the feature flag verification message. If the feature flag is
   * not enabled, the message port is disconnected. If the feature flag is enabled, the
   * download of the CSV file is suppressed.
   *
   * @param message - The port message, contains the feature flag indicator.
   */
  handleFeatureFlagVerification(message: LpFilelessImporterMessage) {
    if (!message.filelessImportEnabled) {
      this.messagePort?.disconnect();
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.loadImporter);
      return;
    }

    this.loadImporter();
  }

  /**
   * Posts a message to the LP importer to trigger the download of the CSV file.
   */
  triggerCsvDownload() {
    this.postWindowMessage({ command: "triggerCsvDownload" });
  }

  /**
   * Initializes the importing mechanism used to import the CSV file into Bitwarden.
   * This is done by observing the DOM for the addition of the LP importer element.
   */
  private loadImporter = () => {
    this.mutationObserver = new MutationObserver(this.handleMutation);
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  /**
   * Handles mutations that are observed by the mutation observer. When the exported data
   * element is added to the DOM, the export data is extracted and the import prompt is
   * displayed.
   *
   * @param mutations - The mutations that were observed.
   */
  private handleMutation = (mutations: MutationRecord[]) => {
    let textContent: string;
    for (let index = 0; index < mutations?.length; index++) {
      const mutation: MutationRecord = mutations[index];

      textContent = Array.from(mutation.addedNodes)
        .filter((node) => node.nodeName.toLowerCase() === "pre")
        .map((node) => (node as HTMLPreElement).textContent?.trim())
        .find((text) => text?.indexOf("url,username,password") >= 0);

      if (textContent) {
        break;
      }
    }

    if (textContent) {
      this.exportData = textContent;
      this.postPortMessage({ command: "displayLpImportNotification" });
      this.mutationObserver.disconnect();
    }
  };

  /**
   * If the export data is present, sends a message to the background with
   * the export data to start the import process.
   */
  private startLpImport() {
    if (!this.exportData) {
      return;
    }

    this.postPortMessage({ command: "startLpImport", data: this.exportData });
    this.messagePort?.disconnect();
  }

  /**
   * Posts a message to the background script.
   *
   * @param message - The message to post.
   */
  private postPortMessage(message: LpFilelessImporterMessage) {
    this.messagePort?.postMessage(message);
  }

  /**
   * Posts a message to the global context of the page.
   *
   * @param message - The message to post.
   */
  private postWindowMessage(message: LpFilelessImporterMessage) {
    globalThis.postMessage(message, "https://lastpass.com");
  }

  /**
   * Sets up the message port that is used to facilitate communication between the
   * background script and the content script.
   */
  private setupMessagePort() {
    this.messagePort = chrome.runtime.connect({ name: FilelessImportPort.LpImporter });
    this.messagePort.onMessage.addListener(this.handlePortMessage);
  }

  /**
   * Handles messages that are sent from the background script.
   *
   * @param message - The message that was sent.
   * @param port - The port that the message was sent from.
   */
  private handlePortMessage = (message: LpFilelessImporterMessage, port: chrome.runtime.Port) => {
    const handler = this.portMessageHandlers[message.command];
    if (!handler) {
      return;
    }

    handler({ message, port });
  };
}

(function () {
  if (!(globalThis as any).lpFilelessImporter) {
    (globalThis as any).lpFilelessImporter = new LpFilelessImporter();
    (globalThis as any).lpFilelessImporter.init();
  }
})();
