import RomParser from '../rom/RomParser';

/** Teams of the ROM as it was loaded (RomParser.getOriginalData), read once per session */
const cache = new WeakMap();

export function originalTeams(romParser) {
  if (!romParser) return [];
  if (!cache.has(romParser)) {
    cache.set(romParser, new RomParser(romParser.getOriginalData()).readAllTeams());
  }
  return cache.get(romParser);
}
