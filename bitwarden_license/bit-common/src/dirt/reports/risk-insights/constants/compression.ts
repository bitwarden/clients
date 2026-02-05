/**
 * Compression format marker used to identify compressed V2C data.
 * This prefix is added to all compressed data for format detection.
 */
export const COMPRESSION_MARKER = "V2C:";

/**
 * Compression algorithm used for Risk Insights report data.
 * Uses browser-native CompressionStream API with gzip format.
 */
export const COMPRESSION_FORMAT = "gzip";
