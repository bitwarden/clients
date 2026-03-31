import { Injectable } from "@angular/core";

import { SendFileProviderService } from "@bitwarden/send-ui";

@Injectable()
export class DesktopSendFileProviderService extends SendFileProviderService {
  async readFile(path: string): Promise<Uint8Array> {
    const buffer: Buffer = await ipc.platform.sendFile.readFile(path);
    return new Uint8Array(buffer);
  }

  async readDirectory(path: string): Promise<{ relativePath: string; contents: number[] }[]> {
    const entries: { relativePath: string; contents: Buffer }[] =
      await ipc.platform.sendFile.readDirectory(path);
    return entries.map((e) => ({
      relativePath: e.relativePath,
      contents: Array.from(new Uint8Array(e.contents)),
    }));
  }
}
