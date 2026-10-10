#!/usr/bin/env node
/* global process, console */
/**
 * Minimal 65816 disassembler for SNES LoROM dumps (research helper).
 *
 * Usage:
 *   node research/tools/disasm65816.mjs <rom.sfc> <start> [count] [--m8] [--x8]
 *     start: file offset (0x3d54b) or SNES address ($07:D54B / 07D54B)
 *     count: number of instructions (default 40)
 *     --m8 / --x8: initial accumulator / index width = 8 bits (default 16)
 *
 * Tracks REP/SEP to size immediates. Accepts headered ROMs (512-byte copier header).
 */
import { readFileSync } from 'fs';

const OPS = [
  ['BRK', 'imm8'], ['ORA', 'dpix'], ['COP', 'imm8'], ['ORA', 'sr'], ['TSB', 'dp'], ['ORA', 'dp'], ['ASL', 'dp'], ['ORA', 'dpil'],
  ['PHP', 'imp'], ['ORA', 'immm'], ['ASL', 'acc'], ['PHD', 'imp'], ['TSB', 'abs'], ['ORA', 'abs'], ['ASL', 'abs'], ['ORA', 'long'],
  ['BPL', 'rel'], ['ORA', 'dpiy'], ['ORA', 'dpi'], ['ORA', 'sriy'], ['TRB', 'dp'], ['ORA', 'dpx'], ['ASL', 'dpx'], ['ORA', 'dpily'],
  ['CLC', 'imp'], ['ORA', 'absy'], ['INC', 'acc'], ['TCS', 'imp'], ['TRB', 'abs'], ['ORA', 'absx'], ['ASL', 'absx'], ['ORA', 'longx'],
  ['JSR', 'abs'], ['AND', 'dpix'], ['JSL', 'long'], ['AND', 'sr'], ['BIT', 'dp'], ['AND', 'dp'], ['ROL', 'dp'], ['AND', 'dpil'],
  ['PLP', 'imp'], ['AND', 'immm'], ['ROL', 'acc'], ['PLD', 'imp'], ['BIT', 'abs'], ['AND', 'abs'], ['ROL', 'abs'], ['AND', 'long'],
  ['BMI', 'rel'], ['AND', 'dpiy'], ['AND', 'dpi'], ['AND', 'sriy'], ['BIT', 'dpx'], ['AND', 'dpx'], ['ROL', 'dpx'], ['AND', 'dpily'],
  ['SEC', 'imp'], ['AND', 'absy'], ['DEC', 'acc'], ['TSC', 'imp'], ['BIT', 'absx'], ['AND', 'absx'], ['ROL', 'absx'], ['AND', 'longx'],
  ['RTI', 'imp'], ['EOR', 'dpix'], ['WDM', 'imm8'], ['EOR', 'sr'], ['MVP', 'bm'], ['EOR', 'dp'], ['LSR', 'dp'], ['EOR', 'dpil'],
  ['PHA', 'imp'], ['EOR', 'immm'], ['LSR', 'acc'], ['PHK', 'imp'], ['JMP', 'abs'], ['EOR', 'abs'], ['LSR', 'abs'], ['EOR', 'long'],
  ['BVC', 'rel'], ['EOR', 'dpiy'], ['EOR', 'dpi'], ['EOR', 'sriy'], ['MVN', 'bm'], ['EOR', 'dpx'], ['LSR', 'dpx'], ['EOR', 'dpily'],
  ['CLI', 'imp'], ['EOR', 'absy'], ['PHY', 'imp'], ['TCD', 'imp'], ['JML', 'long'], ['EOR', 'absx'], ['LSR', 'absx'], ['EOR', 'longx'],
  ['RTS', 'imp'], ['ADC', 'dpix'], ['PER', 'rel16'], ['ADC', 'sr'], ['STZ', 'dp'], ['ADC', 'dp'], ['ROR', 'dp'], ['ADC', 'dpil'],
  ['PLA', 'imp'], ['ADC', 'immm'], ['ROR', 'acc'], ['RTL', 'imp'], ['JMP', 'absi'], ['ADC', 'abs'], ['ROR', 'abs'], ['ADC', 'long'],
  ['BVS', 'rel'], ['ADC', 'dpiy'], ['ADC', 'dpi'], ['ADC', 'sriy'], ['STZ', 'dpx'], ['ADC', 'dpx'], ['ROR', 'dpx'], ['ADC', 'dpily'],
  ['SEI', 'imp'], ['ADC', 'absy'], ['PLY', 'imp'], ['TDC', 'imp'], ['JMP', 'absix'], ['ADC', 'absx'], ['ROR', 'absx'], ['ADC', 'longx'],
  ['BRA', 'rel'], ['STA', 'dpix'], ['BRL', 'rel16'], ['STA', 'sr'], ['STY', 'dp'], ['STA', 'dp'], ['STX', 'dp'], ['STA', 'dpil'],
  ['DEY', 'imp'], ['BIT', 'immm'], ['TXA', 'imp'], ['PHB', 'imp'], ['STY', 'abs'], ['STA', 'abs'], ['STX', 'abs'], ['STA', 'long'],
  ['BCC', 'rel'], ['STA', 'dpiy'], ['STA', 'dpi'], ['STA', 'sriy'], ['STY', 'dpx'], ['STA', 'dpx'], ['STX', 'dpy'], ['STA', 'dpily'],
  ['TYA', 'imp'], ['STA', 'absy'], ['TXS', 'imp'], ['TXY', 'imp'], ['STZ', 'abs'], ['STA', 'absx'], ['STZ', 'absx'], ['STA', 'longx'],
  ['LDY', 'immx'], ['LDA', 'dpix'], ['LDX', 'immx'], ['LDA', 'sr'], ['LDY', 'dp'], ['LDA', 'dp'], ['LDX', 'dp'], ['LDA', 'dpil'],
  ['TAY', 'imp'], ['LDA', 'immm'], ['TAX', 'imp'], ['PLB', 'imp'], ['LDY', 'abs'], ['LDA', 'abs'], ['LDX', 'abs'], ['LDA', 'long'],
  ['BCS', 'rel'], ['LDA', 'dpiy'], ['LDA', 'dpi'], ['LDA', 'sriy'], ['LDY', 'dpx'], ['LDA', 'dpx'], ['LDX', 'dpy'], ['LDA', 'dpily'],
  ['CLV', 'imp'], ['LDA', 'absy'], ['TSX', 'imp'], ['TYX', 'imp'], ['LDY', 'absx'], ['LDA', 'absx'], ['LDX', 'absy'], ['LDA', 'longx'],
  ['CPY', 'immx'], ['CMP', 'dpix'], ['REP', 'imm8'], ['CMP', 'sr'], ['CPY', 'dp'], ['CMP', 'dp'], ['DEC', 'dp'], ['CMP', 'dpil'],
  ['INY', 'imp'], ['CMP', 'immm'], ['DEX', 'imp'], ['WAI', 'imp'], ['CPY', 'abs'], ['CMP', 'abs'], ['DEC', 'abs'], ['CMP', 'long'],
  ['BNE', 'rel'], ['CMP', 'dpiy'], ['CMP', 'dpi'], ['CMP', 'sriy'], ['PEI', 'dp'], ['CMP', 'dpx'], ['DEC', 'dpx'], ['CMP', 'dpily'],
  ['CLD', 'imp'], ['CMP', 'absy'], ['PHX', 'imp'], ['STP', 'imp'], ['JML', 'absil'], ['CMP', 'absx'], ['DEC', 'absx'], ['CMP', 'longx'],
  ['CPX', 'immx'], ['SBC', 'dpix'], ['SEP', 'imm8'], ['SBC', 'sr'], ['CPX', 'dp'], ['SBC', 'dp'], ['INC', 'dp'], ['SBC', 'dpil'],
  ['INX', 'imp'], ['SBC', 'immm'], ['NOP', 'imp'], ['XBA', 'imp'], ['CPX', 'abs'], ['SBC', 'abs'], ['INC', 'abs'], ['SBC', 'long'],
  ['BEQ', 'rel'], ['SBC', 'dpiy'], ['SBC', 'dpi'], ['SBC', 'sriy'], ['PEA', 'abs'], ['SBC', 'dpx'], ['INC', 'dpx'], ['SBC', 'dpily'],
  ['SED', 'imp'], ['SBC', 'absy'], ['PLX', 'imp'], ['XCE', 'imp'], ['JSR', 'absix'], ['SBC', 'absx'], ['INC', 'absx'], ['SBC', 'longx'],
];

const h = (v, n) => v.toString(16).toUpperCase().padStart(n, '0');

export function toFileOffset(arg) {
  const s = String(arg).replace('$', '').replace(':', '');
  if (/^0x/i.test(arg)) return parseInt(arg, 16);
  const v = parseInt(s, 16);
  const bank = (v >> 16) & 0x7f;
  return bank * 0x8000 + ((v & 0xffff) - 0x8000);
}

export function disassemble(rom, start, count = 40, { m8 = false, x8 = false } = {}) {
  let p = start;
  let m = m8;
  let x = x8;
  const lines = [];
  for (let n = 0; n < count && p < rom.length; n++) {
    const op = rom[p];
    const [mn, mode] = OPS[op];
    const b1 = rom[p + 1];
    const w = rom[p + 1] | (rom[p + 2] << 8);
    const l = w | (rom[p + 3] << 16);
    let len = 1;
    let arg = '';
    switch (mode) {
      case 'imp': break;
      case 'acc': arg = 'A'; break;
      case 'imm8': len = 2; arg = `#$${h(b1, 2)}`; break;
      case 'immm': len = m ? 2 : 3; arg = m ? `#$${h(b1, 2)}` : `#$${h(w, 4)}`; break;
      case 'immx': len = x ? 2 : 3; arg = x ? `#$${h(b1, 2)}` : `#$${h(w, 4)}`; break;
      case 'dp': len = 2; arg = `$${h(b1, 2)}`; break;
      case 'dpx': len = 2; arg = `$${h(b1, 2)},X`; break;
      case 'dpy': len = 2; arg = `$${h(b1, 2)},Y`; break;
      case 'dpi': len = 2; arg = `($${h(b1, 2)})`; break;
      case 'dpix': len = 2; arg = `($${h(b1, 2)},X)`; break;
      case 'dpiy': len = 2; arg = `($${h(b1, 2)}),Y`; break;
      case 'dpil': len = 2; arg = `[$${h(b1, 2)}]`; break;
      case 'dpily': len = 2; arg = `[$${h(b1, 2)}],Y`; break;
      case 'sr': len = 2; arg = `$${h(b1, 2)},S`; break;
      case 'sriy': len = 2; arg = `($${h(b1, 2)},S),Y`; break;
      case 'abs': len = 3; arg = `$${h(w, 4)}`; break;
      case 'absx': len = 3; arg = `$${h(w, 4)},X`; break;
      case 'absy': len = 3; arg = `$${h(w, 4)},Y`; break;
      case 'absi': len = 3; arg = `($${h(w, 4)})`; break;
      case 'absix': len = 3; arg = `($${h(w, 4)},X)`; break;
      case 'absil': len = 3; arg = `[$${h(w, 4)}]`; break;
      case 'long': len = 4; arg = `$${h(l, 6)}`; break;
      case 'longx': len = 4; arg = `$${h(l, 6)},X`; break;
      case 'bm': len = 3; arg = `$${h(rom[p + 2], 2)},$${h(b1, 2)}`; break;
      case 'rel': {
        len = 2;
        const t = ((p + 2 + ((b1 << 24) >> 24)) & 0x7fff) | 0x8000;
        arg = `$${h(t, 4)}`;
        break;
      }
      case 'rel16': {
        len = 3;
        const t = ((p + 3 + ((w << 16) >> 16)) & 0x7fff) | 0x8000;
        arg = `$${h(t, 4)}`;
        break;
      }
      default: break;
    }
    if (mn === 'REP') { if (b1 & 0x20) m = false; if (b1 & 0x10) x = false; }
    if (mn === 'SEP') { if (b1 & 0x20) m = true; if (b1 & 0x10) x = true; }
    const snes = `$${h(p >> 15, 2)}:${h((p & 0x7fff) | 0x8000, 4)}`;
    const bytes = [...rom.subarray(p, p + len)].map((v) => h(v, 2)).join(' ');
    lines.push(`${snes}  ${h(p, 5)}  ${bytes.padEnd(12)} ${mn} ${arg}`);
    p += len;
  }
  return lines;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('disasm65816.mjs')) {
  const [file, start, count] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!file || !start) {
    console.log('usage: disasm65816.mjs <rom> <start> [count] [--m8] [--x8]');
    process.exit(1);
  }
  let rom = readFileSync(file);
  if (rom.length % 1024 === 512) rom = rom.subarray(512);
  const opts = { m8: process.argv.includes('--m8'), x8: process.argv.includes('--x8') };
  console.log(disassemble(rom, toFileOffset(start), Number(count || 40), opts).join('\n'));
}
