import { mock, MockProxy } from "jest-mock-extended";

import { Message } from "../../models/native-messaging/message";

import { DuckDuckGoMessageHandlerService } from "./duckduckgo-message-handler.service";
import { NativeMessagingService } from "./native-messaging.service";

describe("NativeMessagingService", () => {
  let duckduckgo: MockProxy<DuckDuckGoMessageHandlerService>;
  let deliver: (message: LegacyMessageWrapper | Message) => Promise<void>;
  let rendererTeardownEnabled: jest.Mock;

  const build = async (mainOwnsDuckDuckGo: boolean) => {
    rendererTeardownEnabled.mockResolvedValue(mainOwnsDuckDuckGo);
    const sut = new NativeMessagingService(duckduckgo);
    await sut.init();
    return sut;
  };

  beforeEach(() => {
    duckduckgo = mock<DuckDuckGoMessageHandlerService>();

    rendererTeardownEnabled = jest.fn().mockResolvedValue(false);
    (global as any).ipc = {
      platform: {
        rendererTeardownEnabled,
        nativeMessaging: {
          onMessage: jest.fn().mockImplementation((handler) => {
            deliver = handler;
          }),
        },
      },
    };
  });

  it("routes a versioned message to the DuckDuckGo handler while the renderer owns it", async () => {
    await build(false);

    await deliver({ version: 1, command: "bw-handshake" } as unknown as Message);

    expect(duckduckgo.handleMessage).toHaveBeenCalledTimes(1);
  });

  it("drops a versioned message once main owns DuckDuckGo", async () => {
    await build(true);

    await deliver({ version: 1, command: "bw-handshake" } as unknown as Message);

    expect(duckduckgo.handleMessage).not.toHaveBeenCalled();
  });
});
