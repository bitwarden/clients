import { Injectable } from "@angular/core";

import {
  MagnifyCardItem,
  MagnifyCommand,
  MagnifyItem,
  MagnifyLoginItem,
} from "../../autofill/models/magnify-commands";

@Injectable({
  providedIn: "root",
})
export class CommandService {
  async searchVault(input: string): Promise<MagnifyItem[]> {
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

  async viewInBitwarden(item: MagnifyItem): Promise<void> {
    await window.ipc.sendCommand({ type: MagnifyCommand.ViewInBitwarden, itemId: item.id });
  }
}
