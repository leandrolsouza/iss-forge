/* global Buffer */
/**
 * Minimal headless libretro frontend (Node + koffi) for ROM research.
 *
 * Runs a libretro core (tested with snes9x2010) without any window: frames,
 * WRAM dumps, save states and joypad input are all scriptable.
 *
 *   const { createEmu } = require('./libretro-emu.cjs');
 *   const emu = createEmu(corePath, romPath);
 *   emu.run(600);                 // frames
 *   emu.press('START');           // tap a button
 *   emu.screenshot('shot.png');
 *   emu.wram();                   // 128 KB Buffer ($7E:0000-$7F:FFFF)
 *
 * Extra dependencies (not part of the app): npm install koffi pngjs
 */
const koffi = require('koffi');
const fs = require('fs');
const { PNG } = require('pngjs');

const RETRO_DEVICE_JOYPAD = 1;
const BTN = {
  B: 0,
  Y: 1,
  SELECT: 2,
  START: 3,
  UP: 4,
  DOWN: 5,
  LEFT: 6,
  RIGHT: 7,
  A: 8,
  X: 9,
  L: 10,
  R: 11,
};

function createEmu(corePath, romPath) {
  const lib = koffi.load(corePath);

  // Registered by name: used in the retro_load_game signature
  koffi.struct('retro_game_info', {
    path: 'const void *', // persistent buffer (a JS string would be a temporary C string)
    data: 'const void *',
    size: 'size_t',
    meta: 'const char *',
  });

  const EnvCb = koffi.proto('bool retro_environment_t(unsigned int cmd, void *data)');
  const VideoCb = koffi.proto(
    'void retro_video_refresh_t(const void *data, unsigned int width, unsigned int height, size_t pitch)',
  );
  const AudioCb = koffi.proto('void retro_audio_sample_t(int16_t left, int16_t right)');
  const AudioBatchCb = koffi.proto(
    'size_t retro_audio_sample_batch_t(const int16_t *data, size_t frames)',
  );
  const PollCb = koffi.proto('void retro_input_poll_t()');
  const StateCb = koffi.proto(
    'int16_t retro_input_state_t(unsigned int port, unsigned int device, unsigned int index, unsigned int id)',
  );

  const f = {
    set_environment: lib.func('void retro_set_environment(retro_environment_t *cb)'),
    set_video_refresh: lib.func('void retro_set_video_refresh(retro_video_refresh_t *cb)'),
    set_audio_sample: lib.func('void retro_set_audio_sample(retro_audio_sample_t *cb)'),
    set_audio_sample_batch: lib.func(
      'void retro_set_audio_sample_batch(retro_audio_sample_batch_t *cb)',
    ),
    set_input_poll: lib.func('void retro_set_input_poll(retro_input_poll_t *cb)'),
    set_input_state: lib.func('void retro_set_input_state(retro_input_state_t *cb)'),
    init: lib.func('void retro_init()'),
    load_game: lib.func('bool retro_load_game(const retro_game_info *game)'),
    run: lib.func('void retro_run()'),
    get_memory_data: lib.func('void *retro_get_memory_data(unsigned int id)'),
    get_memory_size: lib.func('size_t retro_get_memory_size(unsigned int id)'),
    serialize_size: lib.func('size_t retro_serialize_size()'),
    serialize: lib.func('bool retro_serialize(void *data, size_t size)'),
    unserialize: lib.func('bool retro_unserialize(const void *data, size_t size)'),
  };

  let pixelFormat = 0;
  const api_stats = { calls: 0, nulls: 0 }; // 0 = 0RGB1555
  let frame = null; // { w, h, pitch, buf }
  let pressed = new Set();
  const sysdir = Buffer.from(require('os').tmpdir() + '\0');

  const env = koffi.register((cmd, data) => {
    // Compare the full value: experimental commands are 0x10000 | n and must not alias n
    const c = cmd;
    if (c === 10) {
      // SET_PIXEL_FORMAT
      pixelFormat = koffi.decode(data, 'int');
      return true;
    }
    if (c === 3) {
      koffi.encode(data, 'bool', false); // GET_CAN_DUPE
      return true;
    }
    // GET_SYSTEM/SAVE_DIRECTORY (9/31) deliberately unsupported: a string encoded here
    // would be freed after the callback while the core keeps the pointer.
    if (c === 9 || c === 31) return false;
    return false;
  }, koffi.pointer(EnvCb));
  const video = koffi.register((data, w, h, pitch) => {
    api_stats.calls++;
    if (!data) {
      api_stats.nulls++;
      return;
    }
    // The last line may be shorter than pitch: never read past width * bpp on it
    const bpp = pixelFormat === 1 ? 4 : 2;
    const len = pitch * (h - 1) + w * bpp;
    const bytes = koffi.decode(data, koffi.array('uint8_t', len));
    const buf = Buffer.alloc(pitch * h);
    Buffer.from(bytes).copy(buf);
    frame = { w, h, pitch, buf };
  }, koffi.pointer(VideoCb));
  const audio = koffi.register(() => {}, koffi.pointer(AudioCb));
  const audioBatch = koffi.register((d, frames) => frames, koffi.pointer(AudioBatchCb));
  const poll = koffi.register(() => {}, koffi.pointer(PollCb));
  const state = koffi.register((port, device, index, id) => {
    if (port !== 0 || device !== RETRO_DEVICE_JOYPAD) return 0;
    return pressed.has(id) ? 1 : 0;
  }, koffi.pointer(StateCb));

  f.set_environment(env);
  f.init();
  f.set_video_refresh(video);
  f.set_audio_sample(audio);
  f.set_audio_sample_batch(audioBatch);
  f.set_input_poll(poll);
  f.set_input_state(state);

  const rom = fs.readFileSync(romPath);
  const romBuf = Buffer.from(rom);
  const pathBuf = Buffer.from(romPath + '\0', 'utf8');
  const ok = f.load_game({ path: pathBuf, data: romBuf, size: romBuf.length, meta: null });
  if (!ok) throw new Error('retro_load_game failed');

  // Keep native-facing buffers and callbacks alive: the core may keep pointers to them
  // (the ROM data in particular). Letting the GC collect them causes random 0xC0000005 crashes.
  const keepAlive = [romBuf, pathBuf, sysdir, env, video, audio, audioBatch, poll, state];

  const api = {
    _keepAlive: keepAlive,
    BTN,
    run(frames = 1, buttons = []) {
      pressed = new Set(buttons.map((b) => (typeof b === 'string' ? BTN[b] : b)));
      for (let i = 0; i < frames; i++) f.run();
      pressed = new Set();
    },
    press(button, hold = 4, after = 20) {
      api.run(hold, [button]);
      api.run(after);
    },
    wram() {
      const size = Number(f.get_memory_size(2)); // RETRO_MEMORY_SYSTEM_RAM
      const ptr = f.get_memory_data(2);
      return Buffer.from(koffi.decode(ptr, koffi.array('uint8_t', size)));
    },
    saveState() {
      const n = Number(f.serialize_size());
      const b = Buffer.alloc(n);
      f.serialize(b, n);
      return b;
    },
    loadState(b) {
      f.unserialize(b, b.length);
    },
    screenshot(file) {
      if (!frame) return false;
      const { w, h, pitch, buf } = frame;
      const png = new PNG({ width: w, height: h });
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let r, g, b;
          if (pixelFormat === 1) {
            const o = y * pitch + x * 4;
            b = buf[o];
            g = buf[o + 1];
            r = buf[o + 2];
          } else {
            const o = y * pitch + x * 2;
            const v = buf[o] | (buf[o + 1] << 8);
            if (pixelFormat === 2) {
              r = ((v >> 11) & 31) << 3;
              g = ((v >> 5) & 63) << 2;
              b = (v & 31) << 3;
            } else {
              r = ((v >> 10) & 31) << 3;
              g = ((v >> 5) & 31) << 3;
              b = (v & 31) << 3;
            }
          }
          const p = (y * w + x) * 4;
          png.data[p] = r;
          png.data[p + 1] = g;
          png.data[p + 2] = b;
          png.data[p + 3] = 255;
        }
      }
      fs.writeFileSync(file, PNG.sync.write(png));
      return true;
    },
    pixelFormat: () => pixelFormat,
    stats: () => api_stats,
  };
  return api;
}

module.exports = { createEmu, BTN };
