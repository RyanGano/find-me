/**
 * One-bit memories a page keeps in `localStorage`: a panel has been read, a warning
 * dismissed. Nothing here is a result or a streak -- those live in `storage.ts`.
 *
 * Wrapped so a browser that refuses to hand storage over cannot take the whole page down
 * with it. Reading `localStorage` throws outright -- not returns null -- when a browser is
 * set to block all website data, which is exactly the setting a player who loses their
 * streak is most likely to be running. A flag that cannot be read is unset, and one that
 * cannot be written simply comes back next time.
 */

/** The daily game's How to play has been read. A friend's hunt reads it too. */
export const HOWTO_SEEN = 'find-me:howto-seen';

export function hasFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function setFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // Nothing is being kept on this browser; the flag is simply unset next time.
  }
}
