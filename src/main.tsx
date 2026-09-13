import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Testbed from './Testbed';
import { Diagnostics } from './components/Diagnostics';
import FriendHunt, { StoredHunt } from './FriendHunt';
import { hideFromHash, shortCodeFromSearch } from './game/hide';
import { parseRestore } from './game/restore';
import { Restore } from './Restore';
import HideMaker from './HideMaker';
import './index.css';

const params = new URLSearchParams(window.location.search);

// `?diag` answers the one question the game itself cannot: does anything this site
// writes survive the browser being quit? It is not linked from anywhere.
const diag = params.has('diag');

// `?restore=` puts a lost time back on the browser it was lost on, and reports what it
// replaced. A page of its own because it writes to the results store, which is no thing
// to do underneath a board that has already read the day it is about to be handed. See
// `restore.ts` for why this is a link rather than a console session.
const restore = parseRestore(window.location.search);

// `?beta` is the play-test bench: paintings that are not in the game, served in
// rounds to people who have agreed to try them. The link says `beta` because that is
// what it is to the person being handed it; the code says `testbed` throughout because
// that is what it is to us. It is a different app on the same
// board, and it is chosen here rather than inside `App` so that the daily game has no
// branch in it at all -- nothing about a round can reach a player who is not on one.
const testbed = params.has('beta');

// `#h=` is a hide a friend set: the whole puzzle is packed into the fragment, which is
// never sent to the host. It plays for anyone -- test mode or not -- and records nothing.
const hide = hideFromHash(window.location.hash);
// A link pasted into a tab that is already open only changes the fragment, which does
// not reload the page -- so reload it, or the link would appear to do nothing.
window.addEventListener('hashchange', () => {
  if (hideFromHash(window.location.hash) !== hide) window.location.reload();
});

// `?p=` is a hide stored on the tally server behind a short code. The page fetches it by
// that code alone, whether or not this browser is counted, and plays it like a `#h=` link.
const stored = shortCodeFromSearch(window.location.search);

// `?hide` makes one. The daily board offers it once the day's puzzle is over -- never
// during a hunt -- but the address works on its own, and the links it makes point at the
// real site and play for anyone.
const making = params.has('hide');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {diag ? (
      <Diagnostics />
    ) : restore ? (
      <Restore request={restore.request} />
    ) : hide ? (
      <FriendHunt code={hide} />
    ) : stored ? (
      <StoredHunt code={stored} />
    ) : making ? (
      <HideMaker />
    ) : testbed ? (
      <Testbed />
    ) : (
      <App />
    )}
  </StrictMode>,
);
