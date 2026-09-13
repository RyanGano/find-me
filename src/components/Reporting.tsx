import { useState } from 'react';
import { isInAppBrowser } from '../game/browser';
import { isCounted, setCounted } from '../game/count';

interface Props {
  onBack: () => void;
}

/**
 * What the site sends, in plain words, and the switch that stops it.
 *
 * A panel of its own so that every screen which sends anything -- the daily game, a
 * friend's hide, the hide maker -- can open the same account of it rather than each
 * carrying a paraphrase that drifts. Lists rather than paragraphs: it is a thing people
 * scan for the one item they are worried about.
 */
export function Reporting({ onBack }: Props) {
  const [on, setOn] = useState(isCounted);
  // Said once the switch has been pressed, and only where the choice will not last: a
  // browser that refused to save it, or another app's browser that forgets it on closing.
  const [lasts, setLasts] = useState<'saved' | 'page' | 'app'>('saved');

  const toggle = () => {
    const next = !on;
    const saved = setCounted(next);
    setOn(next);
    setLasts(!saved ? 'page' : isInAppBrowser() ? 'app' : 'saved');
  };

  return (
    <div className="howto reporting" role="dialog" aria-label="What’s reported">
      <h2>What&rsquo;s reported</h2>
      <p className="howto-note">
        Find Me sends a few anonymous counts so we can see how the puzzles play. No account,
        no name, and nothing kept that identifies you.
      </p>

      <h3>Each daily run</h3>
      <ul>
        <li>That it started, and how it ended: found, given up, or left</li>
        <li>How long it took</li>
        <li>How far in you took a hint, or first pressed give up before it opened</li>
        <li>Whether you shared your result or opened your stats</li>
      </ul>

      <h3>Hide one for a friend</h3>
      <ul>
        <li>That the maker was opened, and that a hide was shared (and whether as a short link)</li>
        <li>That a hide was opened or found, that the finder shared back, or why a link didn&rsquo;t open</li>
        <li>None of these say which hide</li>
      </ul>

      <p className="howto-note">
        A hide you share is saved on our server so its link can be short: its painting, shape,
        position, color and name, and nothing about who made it. A short link someone sends
        you always opens; only that hide is asked for, and nothing about you is kept.
      </p>
      <p className="howto-note">
        Once you finish a day, the game asks how everyone else did on it. That request
        isn&rsquo;t recorded.
      </p>

      <button type="button" role="switch" aria-checked={on} className="switch" onClick={toggle}>
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
        <span>
          Report my runs: <strong>{on ? 'On' : 'Off'}</strong>
        </span>
      </button>
      {lasts !== 'saved' && (
        <p className="howto-note switch-note" role="status">
          {lasts === 'page'
            ? 'This browser won’t save your choice, so it’s only remembered until you close Find Me.'
            : 'This app’s browser forgets your choice when it closes, so it’s only remembered until then.'}
        </p>
      )}
      <p className="howto-note">
        With reporting off, nothing above is sent, you won&rsquo;t see how everyone else did,
        and your hides are shared as longer links.
      </p>

      <div className="howto-foot">
        <button type="button" className="btn btn-primary" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
