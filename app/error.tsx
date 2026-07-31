"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="ldz-error-page" role="alert">
      <h1>Niečo sa pokazilo</h1>
      <p>Stránku sa nepodarilo načítať. Skúste to prosím znova.</p>
      {error?.message ? (
        <p className="ldz-error-page__detail">{error.message}</p>
      ) : null}
      <button type="button" className="ldz-btn ldz-btn--secondary" onClick={reset}>
        Skúsiť znova
      </button>
    </div>
  );
}
