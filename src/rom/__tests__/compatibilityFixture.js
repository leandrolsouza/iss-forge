import { ISS_ENGINE_SIGNATURES } from '../romCompatibility';

/** Synthetic engine/table layout; contains no commercial ROM data beyond short signatures. */
export function seedSupportedLayout(data, header = 0) {
  for (const { offset, hex } of ISS_ENGINE_SIGNATURES) {
    data.set(
      Uint8Array.from(hex.match(/../g), (byte) => parseInt(byte, 16)),
      offset + header,
    );
  }
  const word = (offset, value) => {
    data[header + offset] = value & 0xff;
    data[header + offset + 1] = value >> 8;
  };
  for (let i = 0; i < 27; i++) {
    word(0xded7 + i * 2, 0x87ec + i * 90);
    word(0x382e4 + i * 2, 0x831c + i * 44);
  }
  return data;
}
