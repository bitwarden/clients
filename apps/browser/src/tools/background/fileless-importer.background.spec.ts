import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/services/policy/policy.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { ConfigService } from "@bitwarden/common/platform/services/config/config.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { Importer, ImportResult, ImportServiceAbstraction } from "@bitwarden/importer/core";

import NotificationBackground from "../../autofill/background/notification.background";
import { createPortSpyMock } from "../../autofill/spec/autofill-mocks";
import {
  flushPromises,
  sendPortMessage,
  triggerRuntimeOnConnectEvent,
} from "../../autofill/spec/testing-utils";
import { BrowserApi } from "../../platform/browser/browser-api";
import { FilelessImportPort, FilelessImportType } from "../enums/fileless-import.enums";

import FilelessImporterBackground from "./fileless-importer.background";

jest.mock("rxjs", () => {
  const rxjs = jest.requireActual("rxjs");
  const { firstValueFrom } = rxjs;
  return {
    ...rxjs,
    firstValueFrom: jest.fn(firstValueFrom),
  };
});

describe("FilelessImporterBackground ", () => {
  let filelessImporterBackground: FilelessImporterBackground;
  const configService = mock<ConfigService>();
  const authService = mock<AuthService>();
  const policyService = mock<PolicyService>();
  const notificationBackground = mock<NotificationBackground>();
  const importService = mock<ImportServiceAbstraction>();
  const syncService = mock<SyncService>();

  beforeEach(() => {
    filelessImporterBackground = new FilelessImporterBackground(
      configService,
      authService,
      policyService,
      notificationBackground,
      importService,
      syncService,
    );
    filelessImporterBackground.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("init", () => {
    it("sets up the port message listeners on initialization of the class", () => {
      expect(chrome.runtime.onConnect.addListener).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("handle ports onConnect", () => {
    let lpImporterPort: chrome.runtime.Port;
    let manifestVersionSpy: jest.SpyInstance;
    let executeScriptInTabSpy: jest.SpyInstance;

    beforeEach(() => {
      lpImporterPort = createPortSpyMock(FilelessImportPort.LpImporter);
      manifestVersionSpy = jest.spyOn(BrowserApi, "manifestVersion", "get");
      executeScriptInTabSpy = jest.spyOn(BrowserApi, "executeScriptInTab").mockResolvedValue(null);
      jest.spyOn(authService, "getAuthStatus").mockResolvedValue(AuthenticationStatus.Unlocked);
      jest.spyOn(configService, "getFeatureFlag").mockResolvedValue(true);
      jest.spyOn(filelessImporterBackground as any, "removeIndividualVault");
      (firstValueFrom as jest.Mock).mockResolvedValue(false);
    });

    it("ignores the port connection if the port name is not present in the set of filelessImportNames", async () => {
      const port = createPortSpyMock("some-other-port");

      triggerRuntimeOnConnectEvent(port);
      await flushPromises();

      expect(port.postMessage).not.toHaveBeenCalled();
    });

    it("posts a message to the port indicating that the fileless import feature is disabled if the user's auth status is not unlocked", async () => {
      jest.spyOn(authService, "getAuthStatus").mockResolvedValue(AuthenticationStatus.Locked);

      triggerRuntimeOnConnectEvent(lpImporterPort);
      await flushPromises();

      expect(lpImporterPort.postMessage).toHaveBeenCalledWith({
        command: "verifyFeatureFlag",
        filelessImportEnabled: false,
      });
    });

    it("posts a message to the port indicating that the fileless import feature is disabled if the user's policy removes individual vaults", async () => {
      (firstValueFrom as jest.Mock).mockResolvedValue(true);

      triggerRuntimeOnConnectEvent(lpImporterPort);
      await flushPromises();

      expect(lpImporterPort.postMessage).toHaveBeenCalledWith({
        command: "verifyFeatureFlag",
        filelessImportEnabled: false,
      });
    });

    it("posts a message to the port indicating that the fileless import feature is disabled if the feature flag is turned off", async () => {
      jest.spyOn(configService, "getFeatureFlag").mockResolvedValue(false);

      triggerRuntimeOnConnectEvent(lpImporterPort);
      await flushPromises();

      expect(lpImporterPort.postMessage).toHaveBeenCalledWith({
        command: "verifyFeatureFlag",
        filelessImportEnabled: false,
      });
    });

    it("posts a message to the port indicating that the fileless import feature is enabled", async () => {
      triggerRuntimeOnConnectEvent(lpImporterPort);
      await flushPromises();

      expect(lpImporterPort.postMessage).toHaveBeenCalledWith({
        command: "verifyFeatureFlag",
        filelessImportEnabled: true,
      });
    });

    it("triggers an injection of the `lp-suppress-import-download.js` script in manifest v3", async () => {
      manifestVersionSpy.mockReturnValue(3);

      triggerRuntimeOnConnectEvent(lpImporterPort);
      await flushPromises();

      expect(executeScriptInTabSpy).toHaveBeenCalledWith(
        lpImporterPort.sender.tab.id,
        { file: "content/lp-suppress-import-download.js", runAt: "document_start" },
        { world: "MAIN" },
      );
    });

    it("triggers an injection of the `lp-suppress-import-download-script-append-mv2.js` script in manifest v2", async () => {
      manifestVersionSpy.mockReturnValue(2);

      triggerRuntimeOnConnectEvent(lpImporterPort);
      await flushPromises();

      expect(executeScriptInTabSpy).toHaveBeenCalledWith(
        lpImporterPort.sender.tab.id,
        {
          file: "content/lp-suppress-import-download-script-append-mv2.js",
          runAt: "document_start",
        },
        undefined,
      );
    });
  });

  describe("port messages", () => {
    let notificationPort: chrome.runtime.Port;
    let lpImporterPort: chrome.runtime.Port;

    beforeEach(async () => {
      jest.spyOn(authService, "getAuthStatus").mockResolvedValue(AuthenticationStatus.Unlocked);
      jest.spyOn(configService, "getFeatureFlag").mockResolvedValue(true);
      (firstValueFrom as jest.Mock).mockResolvedValue(false);
      triggerRuntimeOnConnectEvent(createPortSpyMock(FilelessImportPort.NotificationBar));
      triggerRuntimeOnConnectEvent(createPortSpyMock(FilelessImportPort.LpImporter));
      await flushPromises();
      notificationPort = filelessImporterBackground["importNotificationsPort"];
      lpImporterPort = filelessImporterBackground["lpImporterPort"];
    });

    it("skips handling a message if a message handler is not associated with the port message command", () => {
      sendPortMessage(notificationPort, { command: "commandNotFound" });

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    describe("import notification port messages", () => {
      describe("startFilelessImport", () => {
        it("sends a message to start the LastPass fileless import within the content script", () => {
          sendPortMessage(notificationPort, {
            command: "startFilelessImport",
            importType: FilelessImportType.LP,
          });

          expect(lpImporterPort.postMessage).toHaveBeenCalledWith({
            command: "startLpFilelessImport",
          });
        });
      });

      describe("cancelFilelessImport", () => {
        it("sends a message to close the notification bar", async () => {
          sendPortMessage(notificationPort, { command: "cancelFilelessImport" });

          expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
            notificationPort.sender.tab.id,
            {
              command: "closeNotificationBar",
            },
            null,
            expect.anything(),
          );
          expect(lpImporterPort.postMessage).not.toHaveBeenCalledWith({
            command: "triggerCsvDownload",
          });
        });

        it("sends a message to trigger a download of the LP importer CSV", () => {
          sendPortMessage(notificationPort, {
            command: "cancelFilelessImport",
            importType: FilelessImportType.LP,
          });

          expect(lpImporterPort.postMessage).toHaveBeenCalledWith({
            command: "triggerCsvDownload",
          });
          expect(lpImporterPort.disconnect).toHaveBeenCalled();
        });
      });
    });

    describe("lp importer port messages", () => {
      describe("displayLpImportNotification", () => {
        it("creates a request fileless import notification", async () => {
          jest.spyOn(filelessImporterBackground["notificationBackground"], "requestFilelessImport");

          sendPortMessage(lpImporterPort, {
            command: "displayLpImportNotification",
          });
          await flushPromises();

          expect(
            filelessImporterBackground["notificationBackground"].requestFilelessImport,
          ).toHaveBeenCalledWith(lpImporterPort.sender.tab, FilelessImportType.LP);
        });
      });

      describe("startLpImport", () => {
        it("ignores the message if the message does not contain data", () => {
          sendPortMessage(lpImporterPort, {
            command: "startLpImport",
          });

          expect(filelessImporterBackground["importService"].import).not.toHaveBeenCalled();
        });

        it("triggers the import of the LastPass vault", async () => {
          const data = "url,username,password";
          const importer = mock<Importer>();
          jest
            .spyOn(filelessImporterBackground["importService"], "getImporter")
            .mockReturnValue(importer);
          jest.spyOn(filelessImporterBackground["importService"], "import").mockResolvedValue(
            mock<ImportResult>({
              success: true,
            }),
          );
          jest.spyOn(filelessImporterBackground["syncService"], "fullSync");

          sendPortMessage(lpImporterPort, {
            command: "startLpImport",
            data,
          });
          await flushPromises();

          expect(filelessImporterBackground["importService"].import).toHaveBeenCalledWith(
            importer,
            data,
            null,
            null,
            false,
          );
          expect(
            filelessImporterBackground["importNotificationsPort"].postMessage,
          ).toHaveBeenCalledWith({ command: "filelessImportCompleted" });
          expect(filelessImporterBackground["syncService"].fullSync).toHaveBeenCalledWith(true);
        });

        it("posts a failed message if the import fails", async () => {
          const data = "url,username,password";
          const importer = mock<Importer>();
          jest
            .spyOn(filelessImporterBackground["importService"], "getImporter")
            .mockReturnValue(importer);
          jest
            .spyOn(filelessImporterBackground["importService"], "import")
            .mockImplementation(() => {
              throw new Error("error");
            });
          jest.spyOn(filelessImporterBackground["syncService"], "fullSync");

          sendPortMessage(lpImporterPort, {
            command: "startLpImport",
            data,
          });
          await flushPromises();

          expect(
            filelessImporterBackground["importNotificationsPort"].postMessage,
          ).toHaveBeenCalledWith({ command: "filelessImportFailed" });
        });
      });
    });
  });

  describe("handleImporterPortDisconnect", () => {
    it("resets the port properties to null", () => {
      const lpImporterPort = createPortSpyMock(FilelessImportPort.LpImporter);
      const notificationPort = createPortSpyMock(FilelessImportPort.NotificationBar);
      filelessImporterBackground["lpImporterPort"] = lpImporterPort;
      filelessImporterBackground["importNotificationsPort"] = notificationPort;

      filelessImporterBackground["handleImporterPortDisconnect"](lpImporterPort);

      expect(filelessImporterBackground["lpImporterPort"]).toBeNull();
      expect(filelessImporterBackground["importNotificationsPort"]).not.toBeNull();

      filelessImporterBackground["handleImporterPortDisconnect"](notificationPort);

      expect(filelessImporterBackground["importNotificationsPort"]).toBeNull();
    });
  });
});
