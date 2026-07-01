/**
 * Search ROM for team name strings in multiple encodings
 */
const fs = require('fs');

const romPath = process.argv[2];
if (!romPath) { console.log('Usage: node scripts/find-team-names.js <rom.sfc>'); process.exit(1); }

const rom = fs.readFileSync(romPath);
console.log(`ROM size: ${rom.length} bytes`);

function searchPattern(name, pattern) {
  const hex = pattern.map(b => b.toString(16).padStart(2, '0')).join(' ');
  let results = [];
  for (let i = 0; i < rom.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (rom[i + j] !== pattern[j]) { match = false; break; }
    }
    if (match) results.push(i);
  }
  return results;
}

// Try different encodings
const teams = ['IRELAND', 'GERMANY', 'BRAZIL', 'ITALY', 'FRANCE'];

console.log('\n=== Encoding 1: ISS Player Name (A=0x6C) ===');
teams.forEach(name => {
  const pattern = Array.from(name).map(ch => 0x6C + (ch.charCodeAt(0) - 65));
  const results = searchPattern(name, pattern);
  console.log(`${name}: ${results.length > 0 ? results.map(r => '0x' + r.toString(16)).join(', ') : 'NOT FOUND'}`);
});

console.log('\n=== Encoding 2: ASCII ===');
teams.forEach(name => {
  const pattern = Array.from(name).map(ch => ch.charCodeAt(0));
  const results = searchPattern(name, pattern);
  console.log(`${name}: ${results.length > 0 ? results.map(r => '0x' + r.toString(16)).join(', ') : 'NOT FOUND'}`);
});

console.log('\n=== Encoding 3: ASCII with offset -0x40 (A=0x01) ===');
teams.forEach(name => {
  const pattern = Array.from(name).map(ch => ch.charCodeAt(0) - 0x40);
  const results = searchPattern(name, pattern);
  console.log(`${name}: ${results.length > 0 ? results.map(r => '0x' + r.toString(16)).join(', ') : 'NOT FOUND'}`);
});

console.log('\n=== Encoding 4: Shifted ASCII (A=0x00) ===');
teams.forEach(name => {
  const pattern = Array.from(name).map(ch => ch.charCodeAt(0) - 0x41);
  const results = searchPattern(name, pattern);
  console.log(`${name}: ${results.length > 0 ? results.map(r => '0x' + r.toString(16)).join(', ') : 'NOT FOUND'}`);
});

console.log('\n=== Encoding 5: A=0x0A (like old ISS table) ===');
teams.forEach(name => {
  const pattern = Array.from(name).map(ch => 0x0A + (ch.charCodeAt(0) - 65));
  const results = searchPattern(name, pattern);
  console.log(`${name}: ${results.length > 0 ? results.map(r => '0x' + r.toString(16)).join(', ') : 'NOT FOUND'}`);
});

console.log('\n=== Encoding 6: SNES tile index (A=0xC0, like team name tops) ===');
teams.forEach(name => {
  const pattern = Array.from(name).map(ch => {
    const idx = ch.charCodeAt(0) - 65;
    return idx < 16 ? 0xC0 + idx : 0xE0 + (idx - 16);
  });
  const results = searchPattern(name, pattern);
  console.log(`${name}: ${results.length > 0 ? results.map(r => '0x' + r.toString(16)).join(', ') : 'NOT FOUND'}`);
});

// Also try searching for "Ireland" with lowercase
console.log('\n=== Encoding 7: Mixed case ASCII "Ireland" ===');
['Ireland', 'Germany', 'Brazil'].forEach(name => {
  const pattern = Array.from(name).map(ch => ch.charCodeAt(0));
  const results = searchPattern(name, pattern);
  console.log(`${name}: ${results.length > 0 ? results.map(r => '0x' + r.toString(16)).join(', ') : 'NOT FOUND'}`);
});
