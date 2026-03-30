import { Injectable } from "@angular/core";

import {
  MagnifyCommand,
  MagnifyCommandRequest,
  MagnifyCommandResponse,
  MagnifyErrorCode,
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

  /**
   * Checks if an error from a command is an auth-related error.
   * Returns the MagnifyErrorCode if it is, or null otherwise.
   */
  getAuthError(error: unknown): MagnifyErrorCode | null {
    const message = error instanceof Error ? error.message : String(error);
    if (message === MagnifyErrorCode.VaultLocked) {
      return MagnifyErrorCode.VaultLocked;
    }
    if (message === MagnifyErrorCode.LoggedOut) {
      return MagnifyErrorCode.LoggedOut;
    }
    return null;
  }
}
