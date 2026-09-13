import { chromium } from 'playwright';

/** Tried in order: an installed Chrome, then Edge, then Playwright's own if it has one. */
const CHANNELS = ['chrome', 'msedge', undefined];

/** A real installed browser, no download. Shared by the smoke tests. */
export async function launch() {
  let last;
  for (const channel of CHANNELS) {
    try {
      return await chromium.launch({ channel, args: ['--force-device-scale-factor=1'] });
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

/** A PASS/FAIL printer and the list of names that failed, for the script to exit on. */
export function checks() {
  const failures = [];
  const check = (name, ok, detail = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
    if (!ok) failures.push(name);
  };
  return { check, failures };
}
