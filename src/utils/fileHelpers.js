/**
 * File helpers for ROM loading/saving
 * Provides fallbacks for when Electron API is not available (web/dev mode)
 */

/**
 * Open a ROM file via native file input (web fallback)
 * @returns {Promise<{name: string, data: Uint8Array}|null>}
 */
export function openRomWeb() {
  return openBinaryFile('.smc,.sfc,.bin');
}

/**
 * Pick a file with a native file input and read its bytes
 * @param {string} accept - e.g. ".issproj"
 * @returns {Promise<{name: string, data: Uint8Array}|null>} null when cancelled or unreadable
 */
export function openBinaryFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        resolve({
          name: file.name,
          data: new Uint8Array(ev.target.result),
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(file);
    };

    input.click();
  });
}

/**
 * Save ROM data as a downloadable file (web fallback)
 * @param {Uint8Array} data - ROM data
 * @param {string} fileName - Suggested file name
 */
export function saveRomWeb(data, fileName = 'ISS_Modified.smc') {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Check if running inside Electron
 * Re-exported from services/electronBridge for convenience
 */
export { isElectron } from '../services/electronBridge';

/**
 * Generate a modified filename
 * e.g., "ISS.smc" -> "ISS_Modified.smc"
 */
export function getModifiedFilename(originalName) {
  if (!originalName) return 'ISS_Modified.smc';
  const lastDot = originalName.lastIndexOf('.');
  if (lastDot === -1) return originalName + '_Modified';
  const name = originalName.substring(0, lastDot);
  const ext = originalName.substring(lastDot);
  return `${name}_Modified${ext}`;
}
