import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import {
  base64ToUint8Array,
  derivePSKFromPassword,
  encodePairingCode,
  generatePairingPassword,
  generatePSKSalt,
  uint8ArrayToBase64,
} from "./crypto-utils";
import { KeypairStorageService, type KeyPair } from "./keypair-storage.service";
import { NoiseProtocol, NoiseProtocolService } from "./noise-protocol.service";

/**
 * Event types emitted by the tunnel client
 */
export type TunnelClientEvent =
  | { type: "listening"; username: string }
  | { type: "pairing_code_generated"; pairingCode: string; password: string }
  | {
      type: "connection-request";
      clientId: string;
      remoteUsername: string;
      respond: (approved: boolean) => void;
    }
  | { type: "connection-approved"; clientId: string; remoteUsername: string }
  | { type: "connection-denied"; clientId: string; remoteUsername: string }
  | { type: "auth-complete"; remoteUsername: string; phase: "cached" | "first-time" }
  | { type: "handshake-start"; remoteUsername: string }
  | { type: "handshake-progress"; remoteUsername: string; message: string }
  | { type: "handshake-complete"; remoteUsername: string }
  | {
      type: "credential-request";
      domain: string;
      remoteUsername: string;
      respond: (approved: boolean, credential?: any) => void;
    }
  | { type: "credential-approved"; domain: string; remoteUsername: string }
  | { type: "credential-denied"; domain: string; remoteUsername: string }
  | { type: "error"; error: Error; context: string }
  | { type: "disconnected" };

/**
 * Configuration for tunnel client
 */
export interface TunnelClientConfig {
  proxyUrl: string;
  username: string;
  password?: string; // Optional - will be generated if not provided
}

/**
 * Tunnel Client Service - Angular port of WebUserClient
 * Manages secure tunnel connections using Noise Protocol
 */
@Injectable({
  providedIn: "root",
})
export class TunnelClientService {
  private ws?: WebSocket;
  private noiseProtocol?: NoiseProtocol;
  private pskSalt?: Uint8Array;
  private psk?: Uint8Array;
  private staticKeypair?: KeyPair;
  private config?: TunnelClientConfig;

  private eventsSubject = new BehaviorSubject<TunnelClientEvent | null>(null);
  events$: Observable<TunnelClientEvent | null> = this.eventsSubject.asObservable();

  private isConnected = false;

  constructor(
    private logService: LogService,
    private noiseProtocolService: NoiseProtocolService,
    private keypairStorage: KeypairStorageService,
  ) {}

  /**
   * Start listening for tunnel connections
   * @param config Configuration for the tunnel client
   */
  async listen(config: TunnelClientConfig): Promise<void> {
    this.config = config;

    try {
      // Step 1: Connect to proxy
      this.emitEvent({ type: "listening", username: config.username });
      this.logService.info(`[TunnelClient] Connecting to proxy: ${config.proxyUrl}`);

      await this.connectToProxy(config);
      this.logService.info("[TunnelClient] Connected to proxy and listening");

      // Step 2: Load or create static keypair for this device
      this.staticKeypair = await this.keypairStorage.getOrCreateStaticKeypair(
        `user-client-${config.username}`,
      );
      this.logService.info("[TunnelClient] Static keypair loaded/created");

      // Step 3: Generate pairing code (password + PSK salt + username)
      const password = config.password || generatePairingPassword(4);
      this.pskSalt = generatePSKSalt();
      this.psk = await derivePSKFromPassword(password, this.pskSalt);
      const pairingCode = encodePairingCode(password, this.pskSalt, config.username);

      this.logService.info("[TunnelClient] Pairing code generated");
      this.emitEvent({ type: "pairing_code_generated", pairingCode, password });

      // Step 4: Set up message handlers
      this.setupMessageHandlers();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emitEvent({ type: "error", error: err, context: "listen" });
      throw error;
    }
  }

  /**
   * Close connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
      this.isConnected = false;
      this.emitEvent({ type: "disconnected" });
    }
  }

  /**
   * Check if ready to handle credentials
   */
  isReady(): boolean {
    return !!(this.noiseProtocol && this.noiseProtocol.isHandshakeComplete());
  }

  /**
   * Connect to proxy server using WebSocket
   */
  private async connectToProxy(config: TunnelClientConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(config.proxyUrl);

      this.ws.onopen = () => {
        this.ws!.send(
          JSON.stringify({
            type: "user-client-connect",
            username: config.username,
            sessionId: `user-session-${Date.now()}`,
          }),
        );
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "connect-response") {
            if (message.success) {
              this.logService.info("[TunnelClient] Connected to proxy");
              this.isConnected = true;
              resolve();
            } else {
              reject(new Error(`Proxy connection failed: ${message.error}`));
            }
          }
        } catch {
          // Not JSON or not connect response
        }
      };

      this.ws.onerror = (error) => {
        reject(new Error("WebSocket connection error"));
      };

      this.ws.onclose = () => {
        this.logService.info("[TunnelClient] WebSocket connection closed");
        this.isConnected = false;
        this.emitEvent({ type: "disconnected" });
      };
    });
  }

  /**
   * Set up WebSocket message handlers
   */
  private setupMessageHandlers(): void {
    if (!this.ws) {
      throw new Error("Not connected to proxy");
    }

    this.ws.onmessage = async (event: MessageEvent) => {
      try {
        // Handle both text and binary WebSocket messages
        let messageText: string;
        if (typeof event.data === "string") {
          messageText = event.data;
        } else if (event.data instanceof Blob) {
          messageText = await event.data.text();
        } else if (event.data instanceof ArrayBuffer) {
          const decoder = new TextDecoder();
          messageText = decoder.decode(event.data);
        } else {
          this.logService.warning("[TunnelClient] Unknown WebSocket message type");
          return;
        }

        const message = JSON.parse(messageText);

        // Route to appropriate handler
        switch (message.type) {
          case "connection-request":
            await this.handleConnectionRequest(message);
            break;
          case "cached-auth":
            await this.handleCachedAuth(message);
            break;
          case "first-time-auth":
            await this.handleFirstTimeAuth(message);
            break;
          case "noise-message-1":
            await this.handleNoiseMessage1(message);
            break;
          case "noise-message-3":
            await this.handleNoiseMessage3(message);
            break;
          case "credential-request":
            await this.handleCredentialRequest(message);
            break;
        }
      } catch (error) {
        this.logService.error("[TunnelClient] Error handling WebSocket message:", error);
      }
    };
  }

  /**
   * Handle connection request from remote client
   */
  private async handleConnectionRequest(message: any): Promise<void> {
    const { clientId, username, sessionId } = message;

    // For now, always request approval from user
    // In future, implement approval storage
    const event: TunnelClientEvent = {
      type: "connection-request",
      clientId,
      remoteUsername: username,
      respond: (approved: boolean) => {
        if (approved) {
          this.emitEvent({
            type: "connection-approved",
            clientId,
            remoteUsername: username,
          });
        } else {
          this.emitEvent({
            type: "connection-denied",
            clientId,
            remoteUsername: username,
          });
        }

        this.ws!.send(
          JSON.stringify({
            type: "connection-approval",
            sessionId,
            approved,
          }),
        );

        this.logService.info(`[TunnelClient] Connection approval sent: ${approved}`);
      },
    };

    this.emitEvent(event);
  }

  /**
   * Handle cached authentication notification
   */
  private async handleCachedAuth(message: any): Promise<void> {
    const { username, clientId } = message;

    // Use the existing PSK
    this.logService.info(`[TunnelClient] Using cached PSK for ${username}, client id ${clientId}`);

    this.emitEvent({
      type: "auth-complete",
      remoteUsername: username,
      phase: "cached",
    });
  }

  /**
   * Handle first-time authentication
   */
  private async handleFirstTimeAuth(message: any): Promise<void> {
    const { username, clientId } = message;

    if (!this.psk) {
      this.logService.error("[TunnelClient] PSK not generated");
      return;
    }

    this.logService.info(`[TunnelClient] First-time auth for ${username}, ${clientId}`);

    this.emitEvent({
      type: "auth-complete",
      remoteUsername: username,
      phase: "first-time",
    });
  }

  /**
   * Handle Noise message 1 (handshake start)
   */
  private async handleNoiseMessage1(message: any): Promise<void> {
    if (!this.psk) {
      this.logService.error("[TunnelClient] Cannot start Noise handshake: no PSK");
      return;
    }

    if (!this.staticKeypair) {
      this.logService.error("[TunnelClient] Cannot start Noise handshake: no static keypair");
      return;
    }

    const remoteUsername = message.username || "unknown";

    this.emitEvent({
      type: "handshake-start",
      remoteUsername,
    });

    // Initialize Noise Protocol as responder
    this.noiseProtocol = this.noiseProtocolService.createProtocol(
      false,
      this.staticKeypair,
      this.psk,
    );

    const message1 = base64ToUint8Array(message.data);
    this.noiseProtocol.readMessage(message1);

    const message2 = this.noiseProtocol.writeMessage();
    this.ws!.send(
      JSON.stringify({
        type: "noise-message-2",
        data: uint8ArrayToBase64(message2),
      }),
    );

    this.emitEvent({
      type: "handshake-progress",
      remoteUsername,
      message: "Sent message 2",
    });

    this.logService.info("[TunnelClient] Noise message 2 sent");
  }

  /**
   * Handle Noise message 3 (handshake complete)
   */
  private async handleNoiseMessage3(message: any): Promise<void> {
    if (!this.noiseProtocol) {
      this.logService.error("[TunnelClient] Noise protocol not initialized");
      return;
    }

    const remoteUsername = message.username || "unknown";

    const message3 = base64ToUint8Array(message.data);
    this.noiseProtocol.readMessage(message3);

    this.noiseProtocol.split();

    this.emitEvent({
      type: "handshake-complete",
      remoteUsername,
    });

    this.logService.info("[TunnelClient] Noise handshake complete");
  }

  /**
   * Handle credential request from remote client
   */
  private async handleCredentialRequest(message: any): Promise<void> {
    if (!this.noiseProtocol || !this.noiseProtocol.isHandshakeComplete()) {
      this.logService.error("[TunnelClient] Secure channel not established");
      return;
    }

    // Decrypt request
    const encryptedRequest = base64ToUint8Array(message.encrypted);
    const decrypted = this.noiseProtocol.decryptMessage(encryptedRequest);
    const requestText = new TextDecoder().decode(decrypted);
    const requestData = JSON.parse(requestText);

    const { domain, username: remoteUsername, requestId } = requestData;

    // Create event with respond callback
    const event: TunnelClientEvent = {
      type: "credential-request",
      domain,
      remoteUsername,
      respond: (approved: boolean, credential?: any) => {
        if (approved && credential) {
          this.emitEvent({
            type: "credential-approved",
            domain,
            remoteUsername,
          });

          // Send encrypted credential
          const response = JSON.stringify({
            credential,
            domain,
            timestamp: Date.now(),
            requestId,
          });

          const responseBuf = new TextEncoder().encode(response);
          const encrypted = this.noiseProtocol!.encryptMessage(responseBuf);

          this.ws!.send(
            JSON.stringify({
              type: "credential-response",
              encrypted: uint8ArrayToBase64(encrypted),
            }),
          );

          this.logService.info(`[TunnelClient] Credential sent for ${domain}`);
        } else {
          this.emitEvent({
            type: "credential-denied",
            domain,
            remoteUsername,
          });

          // Send denial
          const response = JSON.stringify({
            error: "Credential request denied",
            requestId,
          });

          const responseBuf = new TextEncoder().encode(response);
          const encrypted = this.noiseProtocol!.encryptMessage(responseBuf);

          this.ws!.send(
            JSON.stringify({
              type: "credential-response",
              encrypted: uint8ArrayToBase64(encrypted),
            }),
          );

          this.logService.info(`[TunnelClient] Credential denied for ${domain}`);
        }
      },
    };

    this.emitEvent(event);
  }

  /**
   * Emit an event to subscribers
   */
  private emitEvent(event: TunnelClientEvent): void {
    this.eventsSubject.next(event);
  }
}
