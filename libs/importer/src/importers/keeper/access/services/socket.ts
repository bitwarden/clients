import { create, fromBinary, toBinary } from "@bufbuild/protobuf";

import { ApiRequestSchema, ApiRequestPayloadSchema } from "../generated/api-request_pb";
import { WssClientResponseSchema, WssConnectionRequestSchema } from "../generated/push_pb";
import { PendingMessage, PushMessage, SocketListener } from "../models";

import { base64UrlEncode, decryptAesV2, encryptAesV2 } from "./crypto";
import { encryptWithKeeperKey } from "./keys";

export async function connectPushSocket(
  server: string,
  deviceToken: Uint8Array,
  messageSessionUid: Uint8Array,
  transmissionKey: Uint8Array,
  serverKeyId: number = 7,
  locale: string = "en_US",
): Promise<SocketListener> {
  const connectionRequest = create(WssConnectionRequestSchema, {
    messageSessionUid,
    encryptedDeviceToken: deviceToken,
    deviceTimeStamp: BigInt(Date.now()),
  });

  const connectionRequestBytes = toBinary(WssConnectionRequestSchema, connectionRequest);

  const payload = create(ApiRequestPayloadSchema, {
    payload: connectionRequestBytes,
  });
  const payloadBytes = toBinary(ApiRequestPayloadSchema, payload);
  const encryptedPayload = await encryptAesV2(new Uint8Array(payloadBytes), transmissionKey);
  const encryptedTransmissionKey = await encryptWithKeeperKey(transmissionKey, serverKeyId);

  const apiRequest = create(ApiRequestSchema, {
    encryptedTransmissionKey,
    publicKeyId: serverKeyId,
    locale,
    encryptedPayload,
  });

  const apiRequestBytes = toBinary(ApiRequestSchema, apiRequest);
  const encodedRequest = base64UrlEncode(new Uint8Array(apiRequestBytes));

  const host = server.replace("govcloud.", "");
  const url = `wss://push.services.${host}/wss_open_connection/${encodedRequest}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    const pendingListeners: PendingMessage[] = [];
    const messageQueue: PushMessage[] = [];

    let connected = false;
    let closed = false;

    ws.onopen = () => {
      connected = true;
      resolve({
        waitForMessage(): Promise<PushMessage> {
          return new Promise((msgResolve, msgReject) => {
            if (closed) {
              msgReject(new Error("Socket is closed"));
              return;
            }

            if (messageQueue.length > 0) {
              msgResolve(messageQueue.shift()!);
              return;
            }

            pendingListeners.push({ resolve: msgResolve, reject: msgReject });
          });
        },

        disconnect(): void {
          if (!closed) {
            closed = true;
            ws.close();

            for (const listener of pendingListeners) {
              listener.reject(new Error("Socket disconnected"));
            }
            pendingListeners.length = 0;
          }
        },
      });
    };

    ws.onmessage = async (event: MessageEvent) => {
      try {
        const messageData = new Uint8Array(event.data as ArrayBuffer);
        const decryptedData = await decryptAesV2(messageData, transmissionKey);
        const response = fromBinary(WssClientResponseSchema, decryptedData);

        let parsedMessage: Record<string, unknown> = {};
        if (response.message) {
          try {
            parsedMessage = JSON.parse(response.message) as Record<string, unknown>;
          } catch {
            parsedMessage = { raw: response.message };
          }
        }

        const pushMessage: PushMessage = {
          messageType: response.messageType,
          message: parsedMessage,
        };

        if (pendingListeners.length > 0) {
          const listener = pendingListeners.shift()!;
          listener.resolve(pushMessage);
        } else {
          messageQueue.push(pushMessage);
        }
      } catch {
        // Error processing message
      }
    };

    ws.onerror = () => {
      const error = new Error("WebSocket error");
      if (!connected) {
        reject(error);
      } else {
        for (const listener of pendingListeners) {
          listener.reject(error);
        }
        pendingListeners.length = 0;
      }
    };

    ws.onclose = (event: CloseEvent) => {
      closed = true;

      let closeReason = event.reason || "";
      try {
        const parsed = JSON.parse(closeReason);
        closeReason = parsed.close_reason || closeReason;
      } catch {
        // Ignore JSON parse errors
      }

      for (const listener of pendingListeners) {
        listener.reject(new Error(`Socket closed: ${closeReason || event.code}`));
      }
      pendingListeners.length = 0;
    };
  });
}
