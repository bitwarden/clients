import { Injectable } from "@angular/core";

import {
  MagnifyCommand,
  MagnifyCommandRequest,
  MagnifyCommandResponse,
  MagnifyLoginItem,
} from "../../autofill/models/magnify-commands";

@Injectable({
  providedIn: "root",
})
export class CommandService {
  async searchVault(input: string): Promise<MagnifyLoginItem[]> {
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
}
