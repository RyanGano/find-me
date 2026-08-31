/**
 * Is this page running inside another app's browser rather than a real one?
 *
 * On iOS an app that opens a link in a `WKWebView` -- most social and messaging apps do
 * -- gives that view its own storage container, thrown away when the view closes. Every
 * visit starts blank. Nothing the page writes survives, and nothing the page can do
 * changes that, so the only useful response is to say so and point at the way out.
 *
 * The signal is the user agent, which is a blunt instrument and treated as one: it only
 * ever drives a dismissible sentence, never a behaviour change, and it errs towards
 * staying quiet. A false positive is a line of unwanted advice; a false negative is the
 * silence we already had.
 *
 * The tell on iOS is the absence of the `Safari/` token. Every real browser on the
 * platform carries it -- Safari itself, and Chrome, Firefox and Edge, which are Safari
 * underneath and keep storage properly -- while a plain `WKWebView` does not. Some apps
 * also stamp themselves, and those are matched outright.
 */

/** Apps that announce themselves, and whose web views are ephemeral. */
const APPS =
  /\b(FBAN|FBAV|FB_IAB|Instagram|Twitter|TwitterAndroid|Line|MicroMessenger|Snapchat|Pinterest|LinkedInApp|GSA)\b/i;

export function isInAppBrowser(ua: string = navigator.userAgent): boolean {
  if (APPS.test(ua)) return true;

  // iOS: WebKit without the `Safari/` token is a web view embedded in some other app.
  const isIOS = /\b(iPhone|iPod|iPad)\b/.test(ua);
  if (isIOS && /AppleWebKit/.test(ua) && !/Safari\//.test(ua)) return true;

  // Android's WebView says so outright.
  return /\bwv\b/.test(ua) && /Android/.test(ua);
}

/**
 * What this cannot see: `SFSafariViewController`, the *other* way an app can open a
 * link. It is genuinely Safari, and reports a user agent identical to Safari's, so no
 * amount of sniffing separates them -- but since iOS 11 it too gets its own storage,
 * isolated from the Safari app. A player opening the game that way still starts blank
 * every time, and this returns false for them. `?diag` is the only thing that catches
 * it, which is why the notice recommends the Home Screen as well: an installed copy has
 * its own durable storage and is exempt from WebKit's seven-day sweep, and it is the one
 * answer that holds however the link was opened.
 */
