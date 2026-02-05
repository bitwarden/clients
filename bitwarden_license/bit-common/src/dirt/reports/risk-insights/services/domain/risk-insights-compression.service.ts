/**
 * Service for compressing/decompressing Risk Insights report data.
 * Uses browser-native CompressionStream API (gzip) with chunking for large payloads.
 *
 * BROWSER COMPATIBILITY:
 * - Chrome/Edge 80+
 * - Firefox 113+
 * - Safari 16.4+
 * - Older browsers: Will throw error (no polyfill available)
 */
export class RiskInsightsCompressionService {
  /**
   * Compression format version identifier.
   */
  private readonly COMPRESSION_FORMAT_VERSION = "V2C" as const;

  // Chunk size: 5MB per chunk to avoid memory issues with large payloads
  private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * Compress a string using chunked gzip and encode as Base64.
   * Adds V2C: marker to identify compressed format.
   *
   * For large payloads (730MB+), breaks data into 5MB chunks to avoid browser memory issues.
   *
   * @throws Error if browser doesn't support CompressionStream
   */
  async compressString(data: string): Promise<string> {
    const dataLength = data.length;

    // Calculate number of chunks needed
    const numChunks = Math.ceil(dataLength / this.CHUNK_SIZE);

    const compressedChunks: string[] = [];

    // Process each chunk
    for (let i = 0; i < numChunks; i++) {
      const start = i * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, dataLength);
      const chunk = data.substring(start, end);

      const compressedChunk = await this._compressChunk(chunk);
      compressedChunks.push(compressedChunk);
    }

    // Build final payload: metadata + chunks
    const payload = {
      version: this.COMPRESSION_FORMAT_VERSION,
      numChunks,
      chunks: compressedChunks,
    };

    const result = `${this.COMPRESSION_FORMAT_VERSION}:${JSON.stringify(payload)}`;

    return result;
  }

  /**
   * Decompress a V2C: formatted string.
   * Returns original uncompressed string.
   *
   * @throws Error if invalid format or browser doesn't support DecompressionStream
   */
  async decompressString(compressedData: string): Promise<string> {
    // Check for V2C: marker
    const marker = `${this.COMPRESSION_FORMAT_VERSION}:`;
    if (!compressedData.startsWith(marker)) {
      throw new Error(`Invalid compressed data format - missing ${marker} marker`);
    }

    // Extract payload
    const payloadJson = compressedData.substring(marker.length);
    const payload = JSON.parse(payloadJson);

    if (payload.version !== this.COMPRESSION_FORMAT_VERSION) {
      throw new Error("Invalid compressed data version");
    }

    // Decompress each chunk
    const decompressedChunks: string[] = [];
    for (let i = 0; i < payload.numChunks; i++) {
      const decompressed = await this._decompressChunk(payload.chunks[i]);
      decompressedChunks.push(decompressed);
    }

    // Concatenate chunks
    const result = decompressedChunks.join("");

    return result;
  }

  /**
   * Check if data is compressed (has V2C: marker).
   */
  isCompressed(data: string): boolean {
    return data.startsWith("V2C:");
  }

  /**
   * Compress a single chunk of data.
   */
  private async _compressChunk(chunk: string): Promise<string> {
    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(chunk);

    // Compress with gzip using browser-native API
    const compressionStream = new CompressionStream("gzip");
    const compressedStream = new Blob([uint8Array]).stream().pipeThrough(compressionStream);

    const compressedResponse = new Response(compressedStream);
    const compressed = await compressedResponse.arrayBuffer();

    // Convert to Base64
    return this._arrayBufferToBase64(compressed);
  }

  /**
   * Decompress a single chunk of data.
   */
  private async _decompressChunk(base64: string): Promise<string> {
    // Decode Base64 to ArrayBuffer
    const compressed = this._base64ToArrayBuffer(base64);

    // Decompress with gzip using browser-native API
    const decompressionStream = new DecompressionStream("gzip");
    const decompressedStream = new Blob([compressed]).stream().pipeThrough(decompressionStream);

    const decompressedResponse = new Response(decompressedStream);
    return await decompressedResponse.text();
  }

  private _arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private _base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
