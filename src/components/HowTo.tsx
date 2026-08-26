interface Props {
  thing: string;
  onDismiss: () => void;
}

export function HowTo({ thing, onDismiss }: Props) {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return (
    <div className="howto" role="dialog" aria-label="How to play">
      <h2>How to play</h2>
      <p>
        A {thing} is hidden somewhere in today&rsquo;s painting. Find it, then frame it so it
        appears at the <strong>same size and angle</strong> as the badge in the corner.
      </p>
      <ul>
        {coarse ? (
          <>
            <li>One finger to pan</li>
            <li>Two fingers to pinch and twist</li>
          </>
        ) : (
          <>
            <li>Drag to pan, scroll to zoom</li>
            <li>Shift + scroll or shift + drag to rotate</li>
          </>
        )}
        <li>The size and angle gauges tell you how close you are — they never reveal where it is</li>
      </ul>
      <p className="howto-note">
        The clock starts on your first move. Close enough counts: within 5% on size and 9&deg; on angle.
      </p>
      <button type="button" className="btn btn-primary" onClick={onDismiss}>
        Start
      </button>
    </div>
  );
}
