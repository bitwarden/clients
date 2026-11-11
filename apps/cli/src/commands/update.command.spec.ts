import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { MessageResponse } from "../models/response/message.response";
import { CliLicenseType } from "../platform/cli-license-type";

import { UpdateCommand } from "./update.command";

const CURRENT_VERSION = "2026.10.0";
const LATEST_VERSION = "2026.11.0";
const RELEASE_PAGE_URL = `https://github.com/bitwarden/clients/releases/tag/cli-v${LATEST_VERSION}`;

const ASSET_NAMES = [
  `bw-bit-linux-${LATEST_VERSION}.zip`,
  `bw-bit-linux-arm64-${LATEST_VERSION}.zip`,
  `bw-bit-macos-${LATEST_VERSION}.zip`,
  `bw-bit-macos-arm64-${LATEST_VERSION}.zip`,
  `bw-bit-windows-${LATEST_VERSION}.zip`,
  `bw-oss-linux-${LATEST_VERSION}.zip`,
  `bw-oss-linux-arm64-${LATEST_VERSION}.zip`,
  `bw-oss-macos-${LATEST_VERSION}.zip`,
  `bw-oss-macos-arm64-${LATEST_VERSION}.zip`,
  `bw-oss-windows-${LATEST_VERSION}.zip`,
  `bitwarden-cli.${LATEST_VERSION}.nupkg`,
  `bw_${LATEST_VERSION}_amd64.snap`,
  `bitwarden-cli-${LATEST_VERSION}-npm-build.zip`,
];

const downloadUrl = (name: string) =>
  `https://github.com/bitwarden/clients/releases/download/cli-v${LATEST_VERSION}/${name}`;

const toAssets = (names: string[]) =>
  names.map((name) => ({ name, browser_download_url: downloadUrl(name) }));

const cliRelease = (assetNames: string[] = ASSET_NAMES) => ({
  tag_name: `cli-v${LATEST_VERSION}`,
  html_url: RELEASE_PAGE_URL,
  body: "Release notes",
  assets: toAssets(assetNames),
});

describe("UpdateCommand", () => {
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let apiService: MockProxy<ApiService>;

  const respondWith = (status: number, body: unknown) =>
    apiService.nativeFetch.mockResolvedValue({ status, json: async () => body } as any);

  const createCommand = (
    licenseType: CliLicenseType,
    platform: NodeJS.Platform = "linux",
    arch: NodeJS.Architecture = "x64",
  ) => new UpdateCommand(platformUtilsService, apiService, licenseType, platform, arch);

  const runAndGetMessage = async (command: UpdateCommand) => {
    const response = await command.run();
    expect(response.success).toBe(true);
    return response.data as MessageResponse;
  };

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    apiService = mock<ApiService>();
    platformUtilsService.getApplicationVersion.mockResolvedValue(CURRENT_VERSION);
  });

  describe("asset selection", () => {
    it.each([
      [CliLicenseType.Bit, "linux", "x64", "bw-bit-linux"],
      [CliLicenseType.Bit, "linux", "arm64", "bw-bit-linux-arm64"],
      [CliLicenseType.Bit, "darwin", "x64", "bw-bit-macos"],
      [CliLicenseType.Bit, "darwin", "arm64", "bw-bit-macos-arm64"],
      [CliLicenseType.Bit, "win32", "x64", "bw-bit-windows"],
      [CliLicenseType.Oss, "linux", "x64", "bw-oss-linux"],
      [CliLicenseType.Oss, "linux", "arm64", "bw-oss-linux-arm64"],
      [CliLicenseType.Oss, "darwin", "x64", "bw-oss-macos"],
      [CliLicenseType.Oss, "darwin", "arm64", "bw-oss-macos-arm64"],
      [CliLicenseType.Oss, "win32", "x64", "bw-oss-windows"],
    ] as [CliLicenseType, NodeJS.Platform, NodeJS.Architecture, string][])(
      "returns the %s %s/%s asset",
      async (licenseType, platform, arch, assetPrefix) => {
        respondWith(200, [cliRelease()]);

        const message = await runAndGetMessage(createCommand(licenseType, platform, arch));

        expect(message.raw).toBe(downloadUrl(`${assetPrefix}-${LATEST_VERSION}.zip`));
      },
    );

    it.each([
      ["x64 assets listed first", ASSET_NAMES],
      ["arm64 assets listed first", [...ASSET_NAMES].reverse()],
    ])("does not depend on asset order (%s)", async (_, assetNames) => {
      respondWith(200, [cliRelease(assetNames)]);

      const x64 = await runAndGetMessage(createCommand(CliLicenseType.Bit, "darwin", "x64"));
      const arm64 = await runAndGetMessage(createCommand(CliLicenseType.Bit, "darwin", "arm64"));

      expect(x64.raw).toBe(downloadUrl(`bw-bit-macos-${LATEST_VERSION}.zip`));
      expect(arm64.raw).toBe(downloadUrl(`bw-bit-macos-arm64-${LATEST_VERSION}.zip`));
    });

    it("does not fall back to the other license's asset", async () => {
      const ossOnly = ASSET_NAMES.filter((name) => !name.startsWith("bw-bit-"));
      respondWith(200, [cliRelease(ossOnly)]);

      const message = await runAndGetMessage(createCommand(CliLicenseType.Bit));

      expect(message.raw).toBe(RELEASE_PAGE_URL);
    });

    it("ignores legacy unprefixed asset names", async () => {
      respondWith(200, [cliRelease([`bw-linux-${LATEST_VERSION}.zip`])]);

      const message = await runAndGetMessage(createCommand(CliLicenseType.Bit));

      expect(message.raw).toBe(RELEASE_PAGE_URL);
    });

    it("ignores assets for a different version", async () => {
      respondWith(200, [cliRelease([`bw-bit-linux-${CURRENT_VERSION}.zip`])]);

      const message = await runAndGetMessage(createCommand(CliLicenseType.Bit));

      expect(message.raw).toBe(RELEASE_PAGE_URL);
    });

    it.each([
      ["win32", "arm64"],
      ["linux", "ia32"],
      ["freebsd", "x64"],
    ] as [NodeJS.Platform, NodeJS.Architecture][])(
      "returns the release page for unsupported %s/%s",
      async (platform, arch) => {
        respondWith(200, [cliRelease()]);

        const message = await runAndGetMessage(createCommand(CliLicenseType.Bit, platform, arch));

        expect(message.raw).toBe(RELEASE_PAGE_URL);
      },
    );

    it("returns the releases list when the release has no page URL or assets", async () => {
      respondWith(200, [{ tag_name: `cli-v${LATEST_VERSION}`, assets: null }]);

      const message = await runAndGetMessage(createCommand(CliLicenseType.Bit));

      expect(message.raw).toBe("https://github.com/bitwarden/clients/releases");
    });
  });

  describe("response", () => {
    it("includes the release notes and download URL in the message", async () => {
      respondWith(200, [cliRelease()]);

      const message = await runAndGetMessage(createCommand(CliLicenseType.Bit));

      expect(message.title).toBe(`A new version is available: cli-v${LATEST_VERSION}`);
      expect(message.message).toContain("Release notes");
      expect(message.message).toContain(
        "You can download this update at " + downloadUrl(`bw-bit-linux-${LATEST_VERSION}.zip`),
      );
    });

    it("uses the first CLI release in the list", async () => {
      respondWith(200, [{ tag_name: "desktop-v2026.11.1", assets: [] }, cliRelease()]);

      const message = await runAndGetMessage(createCommand(CliLicenseType.Oss));

      expect(message.raw).toBe(downloadUrl(`bw-oss-linux-${LATEST_VERSION}.zip`));
    });

    it("reports no update when already on the latest version", async () => {
      platformUtilsService.getApplicationVersion.mockResolvedValue(LATEST_VERSION);
      respondWith(200, [cliRelease()]);

      const message = await runAndGetMessage(createCommand(CliLicenseType.Bit));

      expect(message.title).toBe("No update available.");
      expect(message.raw).toBeUndefined();
    });

    it("returns an error when the update API fails", async () => {
      respondWith(500, null);

      const response = await createCommand(CliLicenseType.Bit).run();

      expect(response.success).toBe(false);
      expect(response.message).toBe("Error contacting update API: 500");
    });

    it("returns an error when no CLI release is found", async () => {
      respondWith(200, [{ tag_name: "desktop-v2026.11.1", assets: [] }]);

      const response = await createCommand(CliLicenseType.Bit).run();

      expect(response.success).toBe(false);
      expect(response.message).toBe("Could not find latest CLI version.");
    });
  });
});
