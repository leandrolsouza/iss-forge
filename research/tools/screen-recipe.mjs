/* global process, console */
/**
 * Work out how a screen is built from the ROM (research helper for the screen viewer).
 *
 *   node research/tools/screen-recipe.mjs research/tools/emu-out/mainmenu.st   (ROM=... to use another ROM)
 *
 * Reads a snes9x save state (blocks "XXX:000000:"): VRA = VRAM, FIL = register file
 * ($2100-$213F as last written), PPU = SnapPPU (big-endian: BG bases, scroll, CGRAM).
 * Then:
 *   1. prints the PPU setup (mode, BG map/char bases, sizes, scroll, layers);
 *   2. scans the load lists of bank $82 (header 00 00 = VRAM, 01 00 = WRAM; entries
 *      until FF) and reports every VRAM entry whose block matches the VRAM of the state,
 *      and every WRAM entry whose block is found in a BG map of the state;
 *   3. scans the palette lists of bank $81 ($81:89E6-$81:8C5E, 3-byte descriptors
 *      [blob word in $85][dest index into $81:86F3], ended by 0) and the single
 *      descriptors ($81:8800-$81:89E6) and reports how many CGRAM colours each explains.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { konamiDecompress } from '../../src/rom/KonamiCodec.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const statePath = process.argv[2];
const rom = new Uint8Array(
  fs.readFileSync(
    process.env.ROM ||
      path.join(here, '../../rom/original/International Superstar Soccer (Europe).sfc'),
  ),
);
const JSON_OUT = process.argv.includes('--json');

// --- save state ---
function blocks(buf) {
  const s = Buffer.from(buf).toString('latin1');
  const out = {};
  const re = /([A-Z]{3}):(\d{6}):/g;
  let m;
  while ((m = re.exec(s))) {
    const len = +m[2];
    const at = m.index + m[0].length;
    out[m[1]] = buf.subarray(at, at + len);
    re.lastIndex = at + len;
  }
  return out;
}
export function readState(file) {
  const b = blocks(new Uint8Array(fs.readFileSync(file)));
  const P = b.PPU;
  const be16 = (a) => (P[a] << 8) | P[a + 1];
  const bg = [0, 1, 2, 3].map((n) => {
    const o = 14 + n * 11;
    return {
      scBase: be16(o),
      hofs: be16(o + 2),
      vofs: be16(o + 4),
      bigTiles: P[o + 6],
      nameBase: be16(o + 7),
      scSize: be16(o + 9),
    };
  });
  const cgram = new Uint16Array(256);
  for (let i = 0; i < 256; i++) cgram[i] = be16(63 + i * 2);
  const reg = (a) => b.FIL[a];
  // Colour window 1 from HDMA: a channel writing $2126/$2127 (SDMA, big-endian: AAddress at +8)
  const D = b.DMA;
  const windows = {};
  for (let ch = 0; ch < 8; ch++) {
    const o = ch * 19;
    if (!(reg(0x420c) & (1 << ch)) || (D[o + 6] !== 0x26 && D[o + 6] !== 0x28)) continue;
    const table = (D[o + 7] << 8) | D[o + 8];
    const wr = b.RAM;
    const spans = [];
    let line = 0;
    for (let a = table; wr[a] && spans.length < 32;) {
      const n = wr[a];
      if (n > 0x80) {
        for (let k = 0; k < n - 0x80; k++)
          spans.push([line + k, 1, wr[a + 1 + k * 2], wr[a + 2 + k * 2]]);
        line += n - 0x80;
        a += 1 + (n - 0x80) * 2;
      } else {
        spans.push([line, n, wr[a + 1], wr[a + 2]]);
        line += n;
        a += 3;
      }
    }
    // [first line, lines, left, right] with left <= right
    windows[D[o + 6] === 0x26 ? 'w1' : 'w2'] = spans.filter((s) => s[2] <= s[3]);
  }
  return {
    vram: b.VRA,
    wram: b.RAM,
    cgram,
    bg,
    fixed: [P[2636], P[2637], P[2638]],
    windows,
    mode: P[58],
    bg3Priority: P[59],
    regs: {
      inidisp: reg(0x2100),
      obsel: reg(0x2101),
      bgmode: reg(0x2105),
      tm: reg(0x212c),
      ts: reg(0x212d),
      cgwsel: reg(0x2130),
      cgadsub: reg(0x2131),
      wobjsel: reg(0x2125),
      coldata: null,
    },
  };
}

const word = (a) => rom[a] | (rom[a + 1] << 8);
const fileOf = (ptr) => ((ptr >> 16) & 0x7f) * 0x8000 + ((ptr & 0xffff) - 0x8000);
const hex = (v, n = 4) => v.toString(16).toUpperCase().padStart(n, '0');

// --- load lists of bank $82 ---
const decompCache = new Map();
function decomp(file) {
  if (!decompCache.has(file)) {
    let out = null;
    try {
      const size = word(file);
      if ((size & 0x7fff) > 2 && file + (size & 0x7fff) <= rom.length)
        out = konamiDecompress(rom, file).slice();
    } catch {
      out = null;
    }
    decompCache.set(file, out);
  }
  return decompCache.get(file);
}
/** Real output length: konamiDecompress returns a 64 KB buffer; trim with the decoder's position */
function decompLen(file) {
  const out = decomp(file);
  if (!out) return 0;
  let n = out.length;
  while (n > 0 && out[n - 1] === 0) n--;
  return n;
}

export function scanLoadLists(from = 0x10000, to = 0x18000) {
  const lists = [];
  for (let a = from; a < to - 8; a++) {
    const kind = rom[a + 1] === 0 && (rom[a] === 0 || rom[a] === 1) ? rom[a] : -1;
    if (kind < 0) continue;
    const step = kind === 0 ? 5 : 6;
    const entries = [];
    let p = a + 2;
    let ok = true;
    while (rom[p] !== 0xff && entries.length < 24) {
      if (rom[p] === 0xfe) {
        // FE entry (used by the title logo list): ptr(3) + dest word; skipped here
        p += 6;
        continue;
      }
      const dest = kind === 0 ? word(p) : word(p) | (rom[p + 2] << 16);
      const ptr = word(p + step - 3) | (rom[p + step - 1] << 16);
      const bank = ptr >> 16;
      if (bank < 0x80 || bank > 0x9f || (ptr & 0xffff) < 0x8000) {
        ok = false;
        break;
      }
      if (kind === 1 && dest >> 16 !== 0x7e && dest >> 16 !== 0x7f) {
        ok = false;
        break;
      }
      if (kind === 0 && dest >= 0x8000) {
        ok = false;
        break;
      }
      entries.push({ dest, file: fileOf(ptr) });
      p += step;
    }
    if (!ok || !entries.length || rom[p] !== 0xff) continue;
    if (!entries.every((e) => decomp(e.file))) continue;
    lists.push({ at: a, snes: 0x820000 | (a - 0x10000 + 0x8000), kind, entries });
  }
  return lists;
}

function matchRatio(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let same = 0;
  for (let i = 0; i < n; i++) if (a[i] === b[i]) same++;
  return same / n;
}

// --- palettes ($81) ---
const DEST_TABLE = 0x86f3;
function applyBlob(cg, blobFile, destIndex, mask) {
  // the dest byte is a byte offset into the table of WRAM addresses ($3200 = CGRAM colour 0)
  const dest = (word(DEST_TABLE + destIndex) - 0x3200) >> 1;
  // $80:ACF0: the size word counts output bytes; the loop runs while it stays >= 0
  const count = (word(blobFile) >> 1) + 1;
  let index = dest;
  let produced = 0;
  const put = (c) => {
    if (index > 0 && index % 16 === 0) index++;
    if (index < 256) {
      cg[index] = c;
      mask[index] = 1;
      index++;
    }
    produced++;
  };
  for (let a = blobFile + 2; produced < count && a < blobFile + 2 + 1024; a += 2) {
    const w = word(a);
    if (w & 0x8000) for (let n = 0; n < (w & 0xff) && produced < count; n++) put(0);
    else put(w);
  }
}
const blobFile = (ptr16) => 0x28000 + (ptr16 - 0x8000);
function paletteListAt(a) {
  const items = [];
  for (let p = a; items.length < 40; p += 3) {
    const ptr = word(p);
    if (!ptr) break;
    if (ptr < 0x8000) return null;
    items.push({ blob: blobFile(ptr), dest: rom[p + 2] });
  }
  return items.length ? items : null;
}
export function scanPaletteLists() {
  const out = [];
  for (let y = 0x89e6; y < 0x8c5e;) {
    const items = paletteListAt(y - 0x8000 + 0x8000);
    if (!items) {
      y += 1;
      continue;
    }
    out.push({ y, items });
    y += items.length * 3 + 2;
  }
  for (let y = 0x8800; y < 0x89e6; y += 3) {
    const ptr = word(y);
    if (ptr >= 0x8000)
      out.push({ y, single: true, items: [{ blob: blobFile(ptr), dest: rom[y + 2] }] });
  }
  return out;
}

function main() {
  const st = readState(statePath);
  const name = path.basename(statePath);
  const layers = ['BG1', 'BG2', 'BG3', 'BG4'];
  const report = { state: name, mode: st.mode, bg3Priority: st.bg3Priority, regs: st.regs, bg: [] };
  if (!JSON_OUT) {
    console.log(`# ${name}`);
    console.log(
      `mode ${st.mode} (BG3 priority ${st.bg3Priority})  TM ${hex(st.regs.tm, 2)}  TS ${hex(st.regs.ts, 2)}  CGWSEL ${hex(st.regs.cgwsel, 2)}  CGADSUB ${hex(st.regs.cgadsub, 2)}  OBSEL ${hex(st.regs.obsel, 2)}`,
    );
  }
  st.bg.slice(0, 3).forEach((b, n) => {
    report.bg.push(b);
    if (!JSON_OUT)
      console.log(
        `${layers[n]}: map $${hex(b.scBase)} size ${b.scSize} chars $${hex(b.nameBase)}  scroll ${b.hofs},${b.vofs}`,
      );
  });

  // VRAM loads
  const lists = scanLoadLists();
  const vramHits = [];
  for (const l of lists) {
    l.entries.forEach((e, k) => {
      const out = decomp(e.file);
      const len = decompLen(e.file);
      if (len < 32) return;
      if (l.kind === 0) {
        const at = e.dest * 2;
        const r = matchRatio(out.subarray(0, len), st.vram.subarray(at, at + len));
        if (r >= 0.9) vramHits.push({ list: l.snes, entry: k, dest: e.dest, file: e.file, len, r });
      } else {
        // WRAM buffer: look for it at the start of a BG map, comparing only the cells the
        // block fills (text screens are mostly blank, which would match anything)
        st.bg.slice(0, 3).forEach((b, n) => {
          // \ is the second half of the \ buffer (32x64 maps)
          const at = b.scBase * 2 + (e.dest === 0x7e4b90 ? 0x800 : 0);
          let used = 0;
          let same = 0;
          for (let i = 0; i + 1 < len; i += 2) {
            const w = out[i] | (out[i + 1] << 8);
            if ((w & 0x3ff) === 0) continue;
            used++;
            // tile + flips only: the game recolours the selected item
            if ((w & 0xc3ff) === ((st.vram[at + i] | (st.vram[at + i + 1] << 8)) & 0xc3ff)) same++;
          }
          const r = used ? same / used : 0;
          if (used >= 16 && r >= 0.85)
            vramHits.push({
              list: l.snes,
              entry: k,
              wram: e.dest,
              layer: layers[n],
              file: e.file,
              len,
              r,
            });
        });
      }
    });
  }
  // keep lists where every entry matched (complete) first
  const byList = new Map();
  for (const h of vramHits) {
    if (!byList.has(h.list)) byList.set(h.list, []);
    byList.get(h.list).push(h);
  }
  report.loads = [];
  for (const [snes, hits] of byList) {
    const l = lists.find((x) => x.snes === snes);
    const complete = hits.length === l.entries.length;
    report.loads.push({ list: snes, kind: l.kind, complete, hits });
  }
  report.loads.sort((a, b) => b.complete - a.complete || b.hits.length - a.hits.length);
  if (!JSON_OUT) {
    console.log(`\nload lists matching the VRAM (${lists.length} lists scanned):`);
    for (const r of report.loads.filter((x) => x.complete || x.hits.length > 1)) {
      console.log(
        `  $${hex(r.list, 6)} ${r.kind ? 'WRAM' : 'VRAM'} ${r.complete ? 'complete' : 'partial '}: ` +
          r.hits
            .map((h) =>
              h.wram
                ? `#${h.entry} ${hex(h.wram, 6)}->${h.layer} 0x${hex(h.file, 5)} ${(h.r * 100).toFixed(0)}%`
                : `#${h.entry} $${hex(h.dest)} 0x${hex(h.file, 5)} ${h.len}B ${(h.r * 100).toFixed(0)}%`,
            )
            .join(', '),
      );
    }
  }

  // Greedy cover: apply the load (VRAM list, or a WRAM list placed on a BG map) that makes
  // the most VRAM bytes equal to the state, repeat while it helps
  const candidates = [];
  for (const l of lists) {
    if (l.kind === 0)
      candidates.push({ list: l.snes, writes: l.entries.map((e) => [e.dest * 2, e.file]) });
    else
      st.bg.slice(0, 3).forEach((b, n) => {
        const writes = l.entries.map((e) => [
          b.scBase * 2 + (e.dest === 0x7e4b90 ? 0x800 : 0),
          e.file,
        ]);
        candidates.push({ list: l.snes, layer: layers[n], writes });
      });
  }
  const built = new Uint8Array(0x10000);
  const equal = (v) => {
    let n = 0;
    for (let i = 0; i < 0x10000; i++) if (v[i] === st.vram[i] && st.vram[i]) n++;
    return n;
  };
  let score = equal(built);
  const recipe = [];
  for (let guard = 0; guard < 16; guard++) {
    let best = null;
    for (const cand of candidates) {
      if (recipe.includes(cand)) continue;
      const trial = Uint8Array.from(built);
      cand.writes.forEach(([at, file]) => {
        const out = decomp(file);
        const len = decompLen(file);
        trial.set(out.subarray(0, Math.min(len, 0x10000 - at)), at);
      });
      const s = equal(trial);
      if (!best || s > best.s) best = { cand, s, trial };
    }
    if (!best || best.s - score < 64) break;
    built.set(best.trial);
    score = best.s;
    recipe.push(best.cand);
  }
  const nonZero = st.vram.reduce((n, v) => n + (v ? 1 : 0), 0);
  report.vramRecipe = recipe.map((r) =>
    r.layer ? `${hex(r.list, 6)}@${r.layer}` : hex(r.list, 6),
  );
  report.vramOk = `${score}/${nonZero}`;
  if (!JSON_OUT)
    console.log(`\nVRAM recipe: ${report.vramRecipe.join(' ')} -> ${report.vramOk} non-zero bytes`);

  // palettes
  const pals = scanPaletteLists();
  const scored = pals.map((p) => {
    const cg = new Uint16Array(256);
    const mask = new Uint8Array(256);
    p.items.forEach((it) => applyBlob(cg, it.blob, it.dest, mask));
    let hit = 0;
    let miss = 0;
    for (let i = 0; i < 256; i++) {
      if (!mask[i]) continue;
      if (cg[i] === st.cgram[i]) hit++;
      else miss++;
    }
    return { ...p, hit, miss };
  });
  report.palettes = scored
    .filter((p) => p.hit >= 8 && p.miss <= p.hit)
    .sort((a, b) => b.hit - b.miss - (a.hit - a.miss))
    .slice(0, 12);
  // Greedy: apply the descriptor that fixes the most colours (without breaking more), repeat
  const cur = new Uint16Array(256);
  const okNow = () => cur.reduce((n, c, i) => n + (c === st.cgram[i] ? 1 : 0), 0);
  const chosen = [];
  for (let guard = 0; guard < 24; guard++) {
    let best = null;
    const base = okNow();
    for (const p of scored) {
      if (p.hit < 4) continue;
      const trial = Uint16Array.from(cur);
      const mask = new Uint8Array(256);
      p.items.forEach((it) => applyBlob(trial, it.blob, it.dest, mask));
      let ok = 0;
      for (let i = 0; i < 256; i++) if (trial[i] === st.cgram[i]) ok++;
      if (!best || ok > best.ok) best = { p, ok, trial };
    }
    if (!best || best.ok - base < 3) break;
    cur.set(best.trial);
    chosen.push(best.p);
  }
  report.paletteRecipe = chosen.map((p) => p.y);
  report.paletteOk = okNow();
  if (!JSON_OUT) {
    console.log(
      `\npalette recipe (applied in order): ${chosen.map((p) => `$81:${hex(p.y)}`).join(' ')} -> ${report.paletteOk}/256 colours`,
    );
    const wrongRows = [];
    for (let r = 0; r < 16; r++) {
      let bad = 0;
      for (let i = r * 16; i < r * 16 + 16; i++) if (cur[i] !== st.cgram[i]) bad++;
      if (bad) wrongRows.push(`${r}(${bad})`);
    }
    console.log(`rows still different: ${wrongRows.join(' ') || 'none'}`);
    console.log('\npalette descriptors matching the CGRAM:');
    for (const p of report.palettes)
      console.log(
        `  $81:${hex(p.y)}${p.single ? ' (single)' : ''}: ${p.hit} colours ok, ${p.miss} differ — ` +
          p.items.map((it) => `0x${hex(it.blob, 5)}->${it.dest}`).join(' '),
      );
  } else console.log(JSON.stringify(report, null, 1));
}

if (statePath && import.meta.url === pathToFileURL(process.argv[1]).href) main();
