import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { Response } from "../models/response";
import { MessageResponse } from "../models/response/message.response";
import { CliLicenseType } from "../platform/cli-license-type";

const CLIENTS_RELEASE_LIST_ENDPOINT = "https://api.github.com/repos/bitwarden/clients/releases";
const DEFAULT_DOWNLOAD_URL = "https://github.com/bitwarden/clients/releases";
const UPDATE_COMMAND = "npm install -g @bitwarden/cli";
const CLI_TAG_PREFIX = "cli-v";

/** The OS segment of the release asset name, keyed by `process.platform`. */
const ASSET_OS_NAMES: Partial<Record<NodeJS.Platform, string>> = {
  win32: "windows",
  darwin: "macos",
  linux: "linux",
};

/** The architecture suffix of the release asset name, keyed by `process.arch`. */
const ASSET_ARCH_SUFFIXES: Partial<Record<NodeJS.Architecture, string>> = {
  x64: "",
  arm64: "-arm64",
};

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url?: string;
  body?: string | null;
  assets?: GitHubReleaseAsset[] | null;
}

export class UpdateCommand {
  inPkg = false;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    protected apiService: ApiService,
    private licenseType: CliLicenseType,
    private platform: NodeJS.Platform = process.platform,
    private arch: NodeJS.Architecture = process.arch,
  ) {
    this.inPkg = !!(process as any).pkg;
  }

  async run(): Promise<Response> {
    const response = await this.apiService.nativeFetch(new Request(CLIENTS_RELEASE_LIST_ENDPOINT));
    if (response.status !== 200) {
      return Response.error("Error contacting update API: " + response.status);
    }

    const releases: GitHubRelease[] = await response.json();
    const cliRelease = releases.find((r) => r.tag_name.includes("cli"));
    if (cliRelease == null) {
      return Response.error("Could not find latest CLI version.");
    }

    const currentVersion = await this.platformUtilsService.getApplicationVersion();
    if (cliRelease.tag_name === CLI_TAG_PREFIX + currentVersion) {
      const res = new MessageResponse("No update available.", null);
      res.noColor = true;
      return Response.success(res);
    }

    return Response.success(this.getFoundUpdateResponse(cliRelease));
  }

  private getFoundUpdateResponse(release: GitHubRelease) {
    const downloadUrl = this.getDownloadUrl(release);

    const response = new MessageResponse(
      "A new version is available: " + release.tag_name,
      this.getMessage(release, downloadUrl),
    );
    response.raw = downloadUrl;

    return response;
  }

  private getMessage(release: GitHubRelease, downloadUrl: string) {
    let message = "";

    if (release.body != null && release.body !== "") {
      message = release.body + "\n\n";
    }

    message += "You can download this update at " + downloadUrl;

    if (this.inPkg) {
      message +=
        "\n\nIf you installed this CLI through a package manager " +
        "you should probably update using its update command instead.";
    } else {
      message +=
        "\n\nIf you installed this CLI through NPM " +
        "you should update using `" +
        UPDATE_COMMAND +
        "`";
    }

    return message;
  }

  /**
   * Returns the download URL of the release asset built for this CLI's license, OS and CPU
   * architecture. Falls back to the release page when no matching asset exists.
   */
  private getDownloadUrl(release: GitHubRelease): string {
    const fallbackUrl = release.html_url ?? DEFAULT_DOWNLOAD_URL;

    const assetName = this.getAssetName(release.tag_name);
    if (assetName == null) {
      return fallbackUrl;
    }

    const asset = release.assets?.find((a) => a.name === assetName);
    return asset?.browser_download_url ?? fallbackUrl;
  }

  /**
   * Builds the release asset name for this CLI, e.g. `bw-bit-macos-arm64-2026.11.0.zip`.
   * Returns `null` when no asset is published for this OS or CPU architecture.
   */
  private getAssetName(tagName: string): string | null {
    const os = ASSET_OS_NAMES[this.platform];
    const archSuffix = ASSET_ARCH_SUFFIXES[this.arch];
    if (os == null || archSuffix == null || !tagName.startsWith(CLI_TAG_PREFIX)) {
      return null;
    }

    const version = tagName.slice(CLI_TAG_PREFIX.length);
    return `bw-${this.licenseType}-${os}${archSuffix}-${version}.zip`;
  }
}
