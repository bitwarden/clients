import { Injectable } from "@angular/core";

import {
  MagnifyCardItem,
  MagnifyCommand,
  MagnifyLoginItem,
  MagnifySearchResultItem,
} from "../../autofill/models/magnify-commands";

@Injectable({
  providedIn: "root",
})
export class CommandService {
  /** Requests the main process to resize the magnify window to the given height. */
  resize(height: number): void {
    window.ipc.resize(height);
  }

  async searchVault(input: string): Promise<MagnifySearchResultItem[]> {
    return (await window.ipc.sendCommand({ type: MagnifyCommand.SearchVault, input })).results;
  }

  async copyPassword(item: MagnifyLoginItem): Promise<string> {
    return (await window.ipc.sendCommand({ type: MagnifyCommand.CopyPassword, id: item.id }))
      .result;
  }

  async copyCardNumber(item: MagnifyCardItem): Promise<string> {
    return (await window.ipc.sendCommand({ type: MagnifyCommand.CopyCardNumber, itemId: item.id }))
      .result;
  }

  async copyCardExpiration(item: MagnifyCardItem, format?: string): Promise<string> {
    return (
      await window.ipc.sendCommand({
        type: MagnifyCommand.CopyCardExpiration,
        itemId: item.id,
        ...(format !== undefined ? { format } : {}),
      })
    ).result;
  }

  async copyCardCode(item: MagnifyCardItem): Promise<string> {
    return (await window.ipc.sendCommand({ type: MagnifyCommand.CopyCardCode, itemId: item.id }))
      .result;
  }

  async viewInBitwarden(item: MagnifySearchResultItem): Promise<void> {
    await window.ipc.sendCommand({ type: MagnifyCommand.ViewInBitwarden, itemId: item.id });
  }
}
