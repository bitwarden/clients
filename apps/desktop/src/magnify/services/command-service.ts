import { Injectable } from "@angular/core";

import {
  MagnifyCommand,
  MagnifyCommandRequest,
  MagnifyCommandResponse,
  MagnifyItem,
} from "../../autofill/models/magnify-commands";

@Injectable({
  providedIn: "root",
})
export class CommandService {
  async searchVault(input: string): Promise<MagnifyItem[]> {
    const request: MagnifyCommandRequest = {
      type: MagnifyCommand.SearchVault,
      input,
    };

    const response: MagnifyCommandResponse = await window.ipc.sendCommand(request);

    if (
      response !== undefined &&
      response !== null &&
      response.type === MagnifyCommand.SearchVault
    ) {
      // eslint-disable-next-line no-console
      console.log("search vault results: ", response.results);

      return response.results;
    }

    // eslint-disable-next-line no-console
    console.log("Error in searchVault(): response was not MagnifyCommand.SearchVault as expected");
    return [];
  }

  async copyPassword(id: string): Promise<string> {
    const request: MagnifyCommandRequest = {
      type: MagnifyCommand.CopyPassword,
      id,
    };

    const response: MagnifyCommandResponse = await window.ipc.sendCommand(request);

    if (
      response !== undefined &&
      response !== null &&
      response.type === MagnifyCommand.CopyPassword
    ) {
      // eslint-disable-next-line no-console
      console.log("copy password result: ", response.result);

      return response.result;
    }

    // eslint-disable-next-line no-console
    console.log(
      "Error in copyPassword(): response was not MagnifyCommand.CopyPassword as expected",
    );
    return "";
  }

  async copyCardNumber(itemId: string): Promise<string> {
    const request: MagnifyCommandRequest = {
      type: MagnifyCommand.CopyCardNumber,
      itemId,
    };

    const response: MagnifyCommandResponse = await window.ipc.sendCommand(request);

    if (
      response === undefined ||
      response === null ||
      response.type !== MagnifyCommand.CopyCardNumber
    ) {
      // eslint-disable-next-line no-console
      console.log("Error in copyCardNumber(): expected MagnifyCommand.CopyCardNumber");
      return "";
    }

    // eslint-disable-next-line no-console
    console.log("copy card number result: ", response.result);
    return response.result;
  }

  async copyCardExpiration(itemId: string, format?: string): Promise<string> {
    const request: MagnifyCommandRequest = {
      type: MagnifyCommand.CopyCardExpiration,
      itemId,
      ...(format !== undefined ? { format } : {}),
    };

    const response: MagnifyCommandResponse = await window.ipc.sendCommand(request);

    if (
      response === undefined ||
      response === null ||
      response.type !== MagnifyCommand.CopyCardExpiration
    ) {
      // eslint-disable-next-line no-console
      console.log("Error in copyCardExpiration(): expected MagnifyCommand.CopyCardExpiration");
      return "";
    }

    // eslint-disable-next-line no-console
    console.log("copy card expiration result: ", response.result);
    return response.result;
  }

  async copyCardCode(itemId: string): Promise<string> {
    const request: MagnifyCommandRequest = {
      type: MagnifyCommand.CopyCardCode,
      itemId,
    };

    const response: MagnifyCommandResponse = await window.ipc.sendCommand(request);

    if (
      response === undefined ||
      response === null ||
      response.type !== MagnifyCommand.CopyCardCode
    ) {
      // eslint-disable-next-line no-console
      console.log("Error in copyCardCode(): expected MagnifyCommand.CopyCardCode");
      return "";
    }

    // eslint-disable-next-line no-console
    console.log("copy card code result: ", response.result);
    return response.result;
  }

  async viewInBitwarden(itemId: string): Promise<void> {
    const request: MagnifyCommandRequest = {
      type: MagnifyCommand.ViewInBitwarden,
      itemId,
    };

    await window.ipc.sendCommand(request);
  }
}
