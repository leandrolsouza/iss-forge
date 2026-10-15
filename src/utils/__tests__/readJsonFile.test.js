import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readJsonFile } from '../teamExport';

let input;
let reader;

beforeEach(() => {
  input = { click: vi.fn() };
  reader = { readAsText: vi.fn() };
  vi.stubGlobal('document', { createElement: () => input });
  vi.stubGlobal('FileReader', function () {
    return reader;
  });
});

afterEach(() => vi.unstubAllGlobals());

function selectFile() {
  const pending = readJsonFile();
  input.onchange({ target: { files: [{ name: 'team.json' }] } });
  return pending;
}

describe('JSON file selection', () => {
  it('reads a valid file without discarding its contents', async () => {
    const pending = selectFile();
    reader.onload({ target: { result: '{"name":"Wakanda"}' } });
    expect(await pending).toEqual({ name: 'Wakanda' });
  });

  it.each(['{broken', 'null', ''])('rejects invalid import contents: %s', async (contents) => {
    const pending = selectFile();
    const rejection = expect(pending).rejects.toThrow('importJsonInvalid');
    reader.onload({ target: { result: contents } });
    await rejection;
  });

  it.each(['onerror', 'onabort'])('reports file reading failures through %s', async (event) => {
    const pending = selectFile();
    const rejection = expect(pending).rejects.toThrow('importFileReadFailed');
    reader[event]();
    await rejection;
  });

  it('reports a failure to start the file read', async () => {
    reader.readAsText.mockImplementation(() => {
      throw new Error('File is no longer available');
    });
    await expect(selectFile()).rejects.toThrow('importFileReadFailed');
  });

  it('resolves cancellation without attempting a read', async () => {
    const pending = readJsonFile();
    input.oncancel();
    expect(await pending).toBeNull();
    expect(reader.readAsText).not.toHaveBeenCalled();
  });
});
