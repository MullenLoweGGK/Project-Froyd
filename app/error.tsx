"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="ldz-error-page" role="alert">
      <h1>Niečo sa pokazilo</h1>
      <p>Stránku sa nepodarilo načítať. Skúste to prosím znova.</p>
      <button type="button" className="ldz-btn ldz-btn--secondary" onClick={reset}>
        Skúsiť znova
      </button>
    </div>
  );
}
