import { ipcRenderer } from "electron";

import type { autofill } from "@bitwarden/desktop-napi";

import { Command } from "../platform/main/autofill/command";
import { RunCommandParams, RunCommandResult } from "../platform/main/autofill/native-autofill.main";

export default {
  runCommand: <C extends Command>(params: RunCommandParams<C>): Promise<RunCommandResult<C>> =>
    ipcRenderer.invoke("autofill.runCommand", params),

  listenPasskeyRegistration: (
    fn: (
      clientId: number,
      sequenceNumber: number,
      request: autofill.PasskeyRegistrationRequest,
      completeCallback: (
        error: Error | null,
        response: autofill.PasskeyRegistrationResponse,
      ) => void,
    ) => void,
  ) => {
    ipcRenderer.on(
      "autofill.passkeyRegistration",
      (
        event,
        data: {
          clientId: number;
          sequenceNumber: number;
          request: autofill.PasskeyRegistrationRequest;
        },
      ) => {
        const { clientId, sequenceNumber, request } = data;
        fn(clientId, sequenceNumber, request, (error, response) => {
          if (error) {
            ipcRenderer.send("autofill.completeError", {
              clientId,
              sequenceNumber,
              error: error.message,
            });
            return;
          }

          ipcRenderer.send("autofill.completePasskeyRegistration", {
            clientId,
            sequenceNumber,
            response,
          });
        });
      },
    );
  },

  listenPasskeyAssertion: (
    fn: (
      clientId: number,
      sequenceNumber: number,
      request: autofill.PasskeyAssertionRequest,
      completeCallback: (error: Error | null, response: autofill.PasskeyAssertionResponse) => void,
    ) => void,
  ) => {
    ipcRenderer.on(
      "autofill.passkeyAssertion",
      (
        event,
        data: {
          clientId: number;
          sequenceNumber: number;
          request: autofill.PasskeyAssertionRequest;
        },
      ) => {
        const { clientId, sequenceNumber, request } = data;
        fn(clientId, sequenceNumber, request, (error, response) => {
          if (error) {
            ipcRenderer.send("autofill.completeError", {
              clientId,
              sequenceNumber,
              error: error.message,
            });
            return;
          }

          ipcRenderer.send("autofill.completePasskeyAssertion", {
            clientId,
            sequenceNumber,
            response,
          });
        });
      },
    );
  },

  listenPasskeyAssertionWithoutUserInterface: (
    fn: (
      clientId: number,
      sequenceNumber: number,
      request: autofill.PasskeyAssertionWithoutUserInterfaceRequest,
      completeCallback: (error: Error | null, response: autofill.PasskeyAssertionResponse) => void,
    ) => void,
  ) => {
    ipcRenderer.on(
      "autofill.passkeyAssertionWithoutUserInterface",
      (
        event,
        data: {
          clientId: number;
          sequenceNumber: number;
          request: autofill.PasskeyAssertionWithoutUserInterfaceRequest;
        },
      ) => {
        const { clientId, sequenceNumber, request } = data;
        fn(clientId, sequenceNumber, request, (error, response) => {
          if (error) {
            ipcRenderer.send("autofill.completeError", {
              clientId,
              sequenceNumber,
              error: error.message,
            });
            return;
          }

          ipcRenderer.send("autofill.completePasskeyAssertion", {
            clientId,
            sequenceNumber,
            response,
          });
        });
      },
    );
  },

  configureAutotype: (
    enabled: boolean,
  ) => {
    ipcRenderer.send("autofill.configureAutotype", { enabled });
  },

  // listenAutotypeRequestOld: (
  //   fn: (
  //     windowTitle: string,
  //   ) => Promise<{ username?: string, password?: string }>,
  // ) => {
  //   console.log("listenAutotypeRequest (preload.ts)");
  //   ipcRenderer.on(
  //     "autofill.listenAutotypeRequest",
  //     async (
  //       event,
  //       data: {
  //         windowTitle: string;
  //       },
  //     ) => {
  //       ipcRenderer.send("autofill.completeAutotypeRequest", fn);

  //       // console.log("autofill.listenAutotypeRequest (preload.ts)");
  //       // console.log("    receiving windowTitle: " + data.windowTitle);
  //       // console.log("    calling fn(" + data.windowTitle + ")");
  //       // const result = await fn(data.windowTitle);
  //       // console.log("    result from await: " + JSON.stringify(result));
  //       // console.log("autofill.completeAutotypeRequest, sending fake data");

  //       // //ipcRenderer.send("autofill.completeAutotypeRequest", { username: "fake username", password: "fake password "});
  //       //ipcRenderer.send("autofill.completeAutotypeRequest", result);
  //     },
  //   );
  // },

  listenAutotypeRequest: (
    fn: (
      windowTitle: string,
      completeCallback: (error: Error | null, response: { username?: string, password?: string }) => void,
    ) => void,
  ) => {
    ipcRenderer.on(
      "autofill.listenAutotypeRequest",
      (
        event,
        data: {
          windowTitle: string;
        },
      ) => {
        const { windowTitle } = data;

        fn(windowTitle, (error, response) => {
          if (error) {
            ipcRenderer.send("autofill.completeError", {
              windowTitle,
              error: error.message,
            });
            return;
          }

          ipcRenderer.send("autofill.completeAutotypeRequest", {
            windowTitle,
            response,
          });
        });
      },
    );
  },
};
