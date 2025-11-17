import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { NoiseProtocolService } from "./noise-protocol.service";

export interface TunnelCredentials {
  tunnelUsername: string;
  username: string;
  password: string;
}

/**
 * Service for securely sending credentials to a localhost tunnel server.
 * SECURITY: Only allows connections to loopback addresses (localhost/127.0.0.1/[::1]).
 * Uses Noise Protocol (XXpsk3) for end-to-end encryption.
 */
@Injectable({
  providedIn: "root",
})
export class TunnelService {
  private readonly TUNNEL_PORT = 8086;
  private readonly TUNNEL_ENDPOINT = "/bwTunnelDemo";
  private readonly ALLOWED_LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];

  constructor(
    private logService: LogService,
    private noiseProtocolService: NoiseProtocolService,
  ) {}

  /**
   * Sends credentials to the local tunnel server.
   * @param credentials The username and password to send
   * @throws Error if the connection is not to a loopback address or if the request fails
   */
  async sendCredentials(credentials: TunnelCredentials): Promise<void> {
    const url = `http://localhost:${this.TUNNEL_PORT}${this.TUNNEL_ENDPOINT}`;

    // Validate that we're only connecting to localhost
    const urlObj = new URL(url);
    if (!this.isLoopbackAddress(urlObj.hostname)) {
      const error = `Security violation: Attempted to connect to non-loopback address: ${urlObj.hostname}`;
      this.logService.error(error);
      throw new Error("Tunnel service only allows connections to localhost");
    }

    try {
      const request = new Request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      });

      const response = await fetch(request);

      if (!response.ok) {
        throw new Error(
          `Tunnel server responded with status ${response.status}: ${response.statusText}`,
        );
      }

      this.logService.info("Credentials successfully sent to tunnel server");
    } catch (error) {
      this.logService.error(`Failed to send credentials to tunnel server: ${error}`);
      throw error;
    }
  }

  /**
   * Sends credentials to the local tunnel server with Noise Protocol encryption.
   * Performs a full XXpsk3 handshake and sends encrypted credentials.
   * @param credentials The username and password to send
   * @throws Error if the connection is not to a loopback address or if the request fails
   */
  async sendCredentialsWithNoise(credentials: TunnelCredentials): Promise<void> {
    const url = `http://localhost:${this.TUNNEL_PORT}${this.TUNNEL_ENDPOINT}`;

    // Validate that we're only connecting to localhost
    const urlObj = new URL(url);
    if (!this.isLoopbackAddress(urlObj.hostname)) {
      const error = `Security violation: Attempted to connect to non-loopback address: ${urlObj.hostname}`;
      this.logService.error(error);
      throw new Error("Tunnel service only allows connections to localhost");
    }

    try {
      // Initialize Noise Protocol WASM module
      await this.noiseProtocolService.initialize();

      // Perform Noise handshake as initiator
      const noise = await this.noiseProtocolService.performXXHandshake(
        true, // isInitiator
        async (message: Uint8Array) => {
          // Send handshake message to server
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              "X-Noise-Handshake": "true",
            },
            body: message,
            mode: "cors",
            credentials: "omit",
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(
              `Tunnel server responded with status ${response.status}: ${response.statusText}`,
            );
          }

          // Return the response message
          const arrayBuffer = await response.arrayBuffer();
          return new Uint8Array(arrayBuffer);
        },
      );

      // Encrypt credentials
      const credentialsJson = JSON.stringify(credentials);
      const credentialsBytes = new TextEncoder().encode(credentialsJson);
      const encryptedCredentials = noise.encryptMessage(credentialsBytes);

      // Send encrypted credentials
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Noise-Transport": "true",
        },
        body: encryptedCredentials,
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Tunnel server responded with status ${response.status}: ${response.statusText}`,
        );
      }

      this.logService.info("Encrypted credentials successfully sent to tunnel server");
    } catch (error) {
      this.logService.error(`Failed to send encrypted credentials to tunnel server: ${error}`);
      throw error;
    }
  }

  /**
   * Validates that a hostname is a loopback address.
   * @param hostname The hostname to validate
   * @returns true if the hostname is a loopback address
   */
  private isLoopbackAddress(hostname: string): boolean {
    // Normalize hostname to lowercase for comparison
    const normalizedHost = hostname.toLowerCase();

    // Check against known loopback addresses
    return this.ALLOWED_LOOPBACK_HOSTS.includes(normalizedHost);
  }
}
