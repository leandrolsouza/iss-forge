/**
 * Test: generate team name data for "WAKANDA" and verify against ROM
 * Also read what's currently at Ireland's pointer to compare
 */
const fs = require('fs');

// Import the constants manually (can't use ESM import in CJS)
const ISS_CHAR_REVERSE = {};
// Build char table
for (let i = 0; i < 26; i++) ISS_CHAR_REVERSE[String.fromCharCode(65 + i)] = 0x6C + i;
for (let i = 0; i < 26; i++) ISS_CHAR_REVERSE[String.fromCharCode(97 + i)] = 0x86 + i;
for (let i = 0; i <= 9; i++) ISS_CHAR_REVERSE[String.fromCharCode(48 + i)] = 0x62 + i;
ISS_CHAR_REVERSE[' '] = 0x00;
ISS_CHAR_REVERSE['.'] = 0x54;

const romPath = process.argv[2] || 'E:\\Desenvolvimento\\Games\\ISS-Editor-IA\\rom\\International Superstar Soccer (Europe).sfc';
const rom = fs.readFileSync(romPath);

// Ireland is team ordinal 11 in the pointer table
// Pointer table at 0x39DAE, step 2
const POINTER_OFFSET = 0x39DAE;
const IRELAND_ORDINAL = 11; // from FLAG_DESIGN_ORDINALS[10]

const ptrAddr = POINTER_OFFSET + IRELAND_ORDINAL * 2;
const b1 = rom[ptrAddr];
const b2 = rom[ptrAddr + 1];
const dataAddr = 0x40000 + ((b2 - 0x80) << 8) + b1;

console.log(`Ireland pointer at 0x${ptrAddr.toString(16)}: bytes = ${b1.toString(16)} ${b2.toString(16)}`);
console.log(`Data address: 0x${dataAddr.toString(16)}`);

// Read current data at that address
const count = rom[dataAddr];
console.log(`\nCurrent data at 0x${dataAddr.toString(16)}:`);
console.log(`  Count: ${count} (${count * 4 + 1} bytes total)`);

const data = rom.slice(dataAddr, dataAddr + count * 4 + 1);
console.log(`  Raw: ${Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

// Parse parts
console.log(`\n  Parts:`);
for (let i = 0; i < count; i++) {
  const type = data[1 + i * 4];
  const pos = data[1 + i * 4 + 1];
  const pb1 = data[1 + i * 4 + 2];
  const pb2 = data[1 + i * 4 + 3];
  const signedPos = pos > 127 ? pos - 256 : pos;
  const typeStr = type === 0xF1 ? 'TOP' : type === 0xF9 ? 'BOT' : `?${type.toString(16)}`;
  console.log(`    ${typeStr} pos=${signedPos} b1=0x${pb1.toString(16)} b2=0x${pb2.toString(16)}`);
}

// Try to reconstruct text from parts
console.log(`\n  Reconstructed text:`);
const charParts = [];
for (let i = 0; i < count; i++) {
  const type = data[1 + i * 4];
  const pos = data[1 + i * 4 + 1] > 127 ? data[1 + i * 4 + 1] - 256 : data[1 + i * 4 + 1];
  const pb1 = data[1 + i * 4 + 2];
  if (type === 0xF1) {
    let ch = '';
    if (pb1 >= 0xC0 && pb1 <= 0xCF) ch = String.fromCharCode(65 + (pb1 - 0xC0));
    else if (pb1 >= 0xE0 && pb1 <= 0xE9) ch = String.fromCharCode(81 + (pb1 - 0xE0));
    if (ch) charParts.push({ pos, ch });
  }
}
charParts.sort((a, b) => a.pos - b.pos);
let text = '';
for (let i = 0; i < charParts.length; i++) {
  if (i > 0 && charParts[i].pos - charParts[i - 1].pos > 12) text += ' ';
  text += charParts[i].char || charParts[i].ch;
}
console.log(`  "${text}"`);
