import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Testbed from './Testbed';
import { Diagnostics } from './components/Diagnostics';
import FriendHunt from './FriendHunt';
import { hideFromHash } from './game/hide';
import { isTestMode } from './game/testMode';
import HideMaker from './HideMaker';
import './index.css';

const params = new URLSearchParams(window.location.search);

// `?diag` answers the one question the game itself cannot: does anything this site
// writes survive the browser being quit? It is not linked from anywhere.
const diag = params.has('diag');

// `?beta` is the play-test bench: paintings that are not in the game, served in
// rounds to people who have agreed to try them. The link says `beta` because that is
// what it is to the person being handed it; the code says `testbed` throughout because
// that is what it is to us. It is a different app on the same
// board, and it is chosen here rather than inside `App` so that the daily game has no
// branch in it at all -- nothing about a round can reach a player who is not on one.
const testbed = params.has('beta');

// `#h=` is a hide a friend set: the whole puzzle is in the fragment, which is never sent
// to the host. It plays for anyone -- test mode or not -- and records nothing.
const hide = hideFromHash(window.location.hash);
// A link pasted into a tab that is already open only changes the fragment, which does
// not reload the page -- so reload it, or the link would appear to do nothing.
window.addEventListener('hashchange', () => {
  if (hideFromHash(window.location.hash) !== hide) window.location.reload();
});

// `?test&hide` makes one. Behind test mode for now, so the only people setting hides are
// the ones who asked to; the links they make point at the real site.
const making = params.has('hide') && isTestMode();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {diag ? (
      <Diagnostics />
    ) : hide ? (
      <FriendHunt code={hide} />
    ) : making ? (
      <HideMaker />
    ) : testbed ? (
      <Testbed />
    ) : (
      <App />
    )}
  </StrictMode>,
);
