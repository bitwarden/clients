// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { catchError, firstValueFrom, map } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";

type Version = {
  client: string;
  sdk: string;
};

@Injectable({
  providedIn: "root",
})
export class VersionService {
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private sdkService: SdkService,
  ) {}

  applyVersionToWindow() {
    (window as any).__version = async (): Promise<Version> => {
      return {
        client: await this.platformUtilsService.getApplicationVersion(),
        sdk: await firstValueFrom(
          this.sdkService.client$.pipe(
            map((client) => client.version()),
            catchError(() => "Unsupported"),
          ),
        ),
      };
    };
  }
}
