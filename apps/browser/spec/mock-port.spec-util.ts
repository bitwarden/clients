import { mockDeep } from "jest-mock-extended";

/**
 * Mocks a chrome.runtime.Port set up to send messages through `postMessage` to `onMessage.addListener` callbacks.
 * @param name - The name of the port.
 * @param immediateOnConnectExecution - Whether to immediately execute the onConnect callbacks against the new port.
 * Defaults to false. If true, the creator of the port will not have had a chance to set up listeners yet.
 * @returns a mock chrome.runtime.Port
 */
export function mockPorts() {
  // notify listeners of a new port
  (chrome.runtime.connect as jest.Mock).mockImplementation((portInfo) => {
    const port = mockDeep<chrome.runtime.Port>();
    port.name = portInfo.name;
    port.sender = { url: chrome.runtime.getURL("") };

    // convert to internal port
    delete (port as any).tab;
    delete (port as any).documentId;
    delete (port as any).documentLifecycle;
    delete (port as any).frameId;

    // set message broadcast
    (port.postMessage as jest.Mock).mockImplementation((message) => {
      (port.onMessage.addListener as jest.Mock).mock.calls.forEach(([callbackFn]) => {
        callbackFn(message, port);
      });
    });

    (chrome.runtime.onConnect.addListener as jest.Mock).mock.calls.forEach(([callbackFn]) => {
      callbackFn(port);
    });

    return port;
  });
}
