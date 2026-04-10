import { Injectable } from "@angular/core";

import {
  MagnifyAuthStatus,
  MagnifyCardItem,
  MagnifyCommand,
  MagnifyCommandRequest,
  MagnifyCommandResponse,
  MagnifyLoginItem,
  MagnifySearchResultItem,
} from "../../autofill/models/magnify-commands";

@Injectable({
  providedIn: "root",
})
export class CommandService {
  async getAuthStatus(): Promise<MagnifyAuthStatus> {
    const request: MagnifyCommandRequest = {
      type: MagnifyCommand.GetAuthStatus,
    };

    const response: MagnifyCommandResponse = await window.ipc.sendCommand(request);

    if (response?.type === MagnifyCommand.GetAuthStatus) {
      return response.status;
    }

    return MagnifyAuthStatus.LoggedOut;
  }

  /** Focuses the main Bitwarden window and closes Magnify. */
  focusBitwarden(): void {
    window.ipc.focusBitwarden();
  }

  /** Requests the main process to resize the magnify window to the given height. */
  resize(height: number): void {
    window.ipc.resize(height);
  }

  async searchVault(input: string): Promise<MagnifySearchResultItem[]> {
    return (await window.ipc.sendCommand({ type: MagnifyCommand.SearchVault, input })).results;
  }

  async copyPassword(item: MagnifyLoginItem): Promise<string> {
    return (await window.ipc.sendCommand({ type: MagnifyCommand.CopyPassword, itemId: item.id }))
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
