export class BinaryReader {
  private position: number;
  private isLittleEndian: boolean;

  constructor(public arr: Uint8Array) {
    this.position = 0;

    const uInt32 = new Uint32Array([0x11223344]);
    const uInt8 = new Uint8Array(uInt32.buffer);
    this.isLittleEndian = uInt8[0] === 0x44;
  }

  readBytes(count: number): Uint8Array {
    if (this.position + count > this.arr.length) {
      throw new Error("End of array reached");
    }
    const slice = this.arr.subarray(this.position, this.position + count);
    this.position += count;
    return slice;
  }

  readUInt16(): number {
    const slice = this.readBytes(2);
    const int = slice[0] | (slice[1] << 8);
    // Convert to unsigned int
    return int >>> 0;
  }

  readUInt32(): number {
    const slice = this.readBytes(4);
    const int = slice[0] | (slice[1] << 8) | (slice[2] << 16) | (slice[3] << 24);
    // Convert to unsigned int
    return int >>> 0;
  }

  readUInt16BigEndian(): number {
    let result = this.readUInt16();
    if (this.isLittleEndian) {
      // Extract the two bytes
      const byte1 = result & 0xff;
      const byte2 = (result >> 8) & 0xff;
      // Create a big-endian value by swapping the bytes
      result = (byte1 << 8) | byte2;
    }
    return result;
  }

  readUInt32BigEndian(): number {
    let result = this.readUInt32();
    if (this.isLittleEndian) {
      // Extract individual bytes
      const byte1 = (result >> 24) & 0xff;
      const byte2 = (result >> 16) & 0xff;
      const byte3 = (result >> 8) & 0xff;
      const byte4 = result & 0xff;
      // Create a big-endian value by reordering the bytes
      result = (byte4 << 24) | (byte3 << 16) | (byte2 << 8) | byte1;
    }
    return result;
  }

  seekFromCurrentPosition(offset: number) {
    const newPosition = this.position + offset;
    if (newPosition < 0) {
      throw new Error("Position cannot be negative");
    }
    if (newPosition > this.arr.length) {
      throw new Error("Array not large enough to seek to this position");
    }
    this.position = newPosition;
  }

  atEnd(): boolean {
    return this.position >= this.arr.length - 1;
  }
}
