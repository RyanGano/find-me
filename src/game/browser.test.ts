import { describe, expect, it } from 'vitest';
import { isInAppBrowser } from './browser';

const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const WEBVIEW_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const FACEBOOK_IOS = `${WEBVIEW_IOS} [FBAN/FBIOS;FBAV/468.0.0.44.107;FBBV/605000000]`;
const CHROME_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1';
const FIREFOX_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15';
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const CHROME_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
const WEBVIEW_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36';

describe('isInAppBrowser', () => {
  it('spots a bare iOS web view, which is what an app opening a link gives you', () => {
    expect(isInAppBrowser(WEBVIEW_IOS)).toBe(true);
  });

  it('spots an app that stamps its own name on the user agent', () => {
    expect(isInAppBrowser(FACEBOOK_IOS)).toBe(true);
  });

  it('spots an Android web view', () => {
    expect(isInAppBrowser(WEBVIEW_ANDROID)).toBe(true);
  });

  // Everything below keeps storage properly, and must never be nagged about it.
  it.each([
    ['Safari on iOS', SAFARI_IOS],
    ['Chrome on iOS', CHROME_IOS],
    ['Firefox on iOS', FIREFOX_IOS],
    ['Safari on a Mac', SAFARI_MAC],
    ['Chrome on a desktop', CHROME_DESKTOP],
    ['Chrome on Android', CHROME_ANDROID],
  ])('leaves %s alone', (_name, ua) => {
    expect(isInAppBrowser(ua)).toBe(false);
  });
});
