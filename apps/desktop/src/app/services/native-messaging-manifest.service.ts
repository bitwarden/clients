import { Injectable } from "@angular/core";

@Injectable()
export class NativeMessagingManifestService {
  constructor() {}

  async generate(create: boolean): Promise<Error | null> {
    return ipc.platform.nativeMessaging.manifests.generate(create);
  }
  async generateDuckDuckGo(create: boolean): Promise<Error | null> {
    return ipc.platform.nativeMessaging.manifests.generateDuckDuckGo(create);
  }
}
