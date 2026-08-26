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
        <li>The corner badge lights up once you are close on both size and angle</li>
      </ul>
      <p className="howto-note">
        The painting stays blurred, and the clock stays stopped, until your first move — so
        there is no free look. Close enough counts: within 2% on size and 3.6&deg; on angle.
        Some shapes match at more than one rotation.
      </p>
      <button type="button" className="btn btn-primary" onClick={onDismiss}>
        Start
      </button>
    </div>
  );
}
