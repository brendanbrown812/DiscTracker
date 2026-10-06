"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fatal">
      <h1>Couldn’t open your collection</h1>
      <p>Please try again in a moment.</p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
