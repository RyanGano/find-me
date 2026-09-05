import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Testbed from './Testbed';
import { Diagnostics } from './components/Diagnostics';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>{diag ? <Diagnostics /> : testbed ? <Testbed /> : <App />}</StrictMode>,
);
