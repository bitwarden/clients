// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { Response } from "../models/response";
import { MessageResponse } from "../models/response/message.response";

const CLIENTS_RELEASE_LIST_ENDPOINT = "https://api.github.com/repos/bitwarden/clients/releases";
const DEFAULT_DOWNLOAD_URL = "https://github.com/bitwarden/clients/releases";
const UPDATE_COMMAND = "npm install -g @bitwarden/cli";

export class UpdateCommand {
  inPkg = false;

  constructor(
    private platformUtilsService: PlatformUtilsService,
    protected apiService: ApiService,
  ) {
    this.inPkg = !!(process as any).pkg;
  }

  async run(): Promise<Response> {
    const response = await this.apiService.nativeFetch(new Request(CLIENTS_RELEASE_LIST_ENDPOINT));
    if (response.status !== 200) {
      return Response.error("Error contacting update API: " + response.status);
    }

    const responseJson = await response.json();
    const cliRelease = responseJson.find((r: any) => r.tag_name.includes("cli"));
    if (cliRelease === undefined || cliRelease === null) {
      return Response.error("Could not find latest CLI version.");
    }

    const currentVersion = await this.platformUtilsService.getApplicationVersion();
    if (cliRelease.tag_name === "cli-v" + currentVersion) {
      const response = new MessageResponse(null, null);
      response.title = "No update available.";
      response.noColor = true;
      return Response.success(response);
    }

    const res = this.getFoundUpdateResponse(cliRelease);
    return Response.success(res);
  }

  private getFoundUpdateResponse(release: any) {
    const downloadUrl = this.getDownloadUrl(release.assets);

    const response = new MessageResponse(null, null);
    response.title = "A new version is available: " + release.tag_name;
    response.raw = downloadUrl;
    response.message = this.getMessage(release, downloadUrl);

    return response;
  }

  private getMessage(release: any, downloadUrl: string) {
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

  private getDownloadUrl(assets: any) {
    if (assets == null) {
      return DEFAULT_DOWNLOAD_URL;
    }

    let downloadUrl: string = DEFAULT_DOWNLOAD_URL;

    for (const a of assets) {
      const download: string = a.browser_download_url;
      if (download == null) {
        continue;
      }

      if (download.indexOf(".zip") === -1) {
        continue;
      }

      if (process.platform === "win32" && download.indexOf("bw-windows") > -1) {
        downloadUrl = download;
        break;
      } else if (process.platform === "darwin" && download.indexOf("bw-macos") > -1) {
        downloadUrl = download;
        break;
      } else if (process.platform === "linux" && download.indexOf("bw-linux") > -1) {
        downloadUrl = download;
        break;
      }
    }

    return downloadUrl;
  }
}
