import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** Replace a file only after all bytes have reached the filesystem. */
export function writeAtomic(file, data) {
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temp, 'wx', 0o600);
    fs.writeFileSync(descriptor, data);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    // Keep the destination intact when replacement fails (never unlink it first).
    fs.renameSync(temp, file);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temp, { force: true });
  }
}
