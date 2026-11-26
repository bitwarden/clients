import { Injectable } from "@angular/core";

@Injectable()
export class NativeMessagingManifestService {
  constructor() {}

  async generate(create: boolean): Promise<Error | null> {
    return ipc.platform.nativeMessaging.manifests.generate(create);
  }
  /**
   * @deprecated DuckDuckGo dropped support for the integration here
   * https://github.com/duckduckgo/apple-browsers/pull/7877. We will drop support after a
   * transition period.
   */
  async generateDuckDuckGo(create: boolean): Promise<Error | null> {
    return ipc.platform.nativeMessaging.manifests.generateDuckDuckGo(create);
  }
}
