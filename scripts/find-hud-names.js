/**
 * Deep search for HUD team names - try every possible encoding
 */
const fs = require('fs');
const romPath = process.argv[2] || 'E:\\Desenvolvimento\\Games\\ISS-Editor-IA\\rom\\International Superstar Soccer (Europe).sfc';
const rom = fs.readFileSync(romPath);

function search(pattern) {
  const results = [];
  for (let i = 0; i < rom.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (rom[i + j] !== pattern[j]) { match = false; break; }
    }
    if (match) results.push(i);
  }
  return results;
}

// Try with 0x00 separator between chars (2 bytes per char: char, 0x00)
console.log('=== With 00 separator (char 00 char 00...) ===');
['IRELAND', 'GERMANY', 'BRAZIL'].forEach(name => {
  const pattern = [];
  for (const ch of name) { pattern.push(0x6C + (ch.charCodeAt(0) - 65)); pattern.push(0x00); }
  const r = search(pattern);
  console.log(`${name}: ${r.length > 0 ? r.map(x => '0x' + x.toString(16)).join(', ') : 'NOT FOUND'}`);
});

// What about SNES DTE (Double Tile Encoding)? Each char = 2 bytes tile ref?
// Try searching just for consecutive differences matching the pattern
// IRELAND: I(+0) R(+9) E(-13) L(+7) A(-11) N(+13) D(-10)
// This pattern of differences is unique

console.log('\n=== Brute force: search for any 7+ byte sequence where ===');
console.log('=== consecutive byte differences match IRELAND pattern ===');
// Differences: R-I=9, E-R=-13, L-E=7, A-L=-11, N-A=13, D-N=-10
const diffs = [9, -13, 7, -11, 13, -10]; // IRELAND letter differences

let found = [];
for (let i = 0; i < rom.length - 7; i++) {
  let match = true;
  for (let j = 0; j < diffs.length; j++) {
    const actual = rom[i + j + 1] - rom[i + j];
    if (actual !== diffs[j]) { match = false; break; }
  }
  if (match && rom[i] > 0x01 && rom[i] < 0xF0) { // reasonable first byte
    found.push(i);
  }
}
console.log(`Pattern matches: ${found.length}`);
found.slice(0, 10).forEach(addr => {
  const bytes = Array.from(rom.slice(addr, addr + 10)).map(b => b.toString(16).padStart(2, '0')).join(' ');
  console.log(`  0x${addr.toString(16)}: ${bytes} (first byte = ${rom[addr]})`);
});

// Also check if names are stored as tile IDs in a tilemap
// In SNES, tilemaps use 2 bytes per tile: [tile_number, attributes]
console.log('\n=== 2-byte-per-char search (tilemap format) ===');
['IRELAND', 'GERMANY'].forEach(name => {
  // Try: each letter stored as 2 bytes where first byte is sequential index
  // A=some_base, B=base+1, etc
  for (let base = 0; base < 256; base++) {
    const pattern = [];
    for (const ch of name) {
      pattern.push(base + (ch.charCodeAt(0) - 65));
      // Second byte could be anything consistent - try 0x00 through 0x3F
    }
    // Search with wildcard second bytes (just match first byte of each pair)
    let matchCount = 0;
    for (let i = 0; i < rom.length - name.length * 2; i++) {
      let match = true;
      for (let j = 0; j < name.length; j++) {
        if (rom[i + j * 2] !== pattern[j]) { match = false; break; }
      }
      if (match) {
        matchCount++;
        if (matchCount <= 2) {
          const bytes = Array.from(rom.slice(i, i + name.length * 2 + 2)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          console.log(`  ${name} base=0x${base.toString(16)} at 0x${i.toString(16)}: ${bytes}`);
        }
      }
    }
  }
});
