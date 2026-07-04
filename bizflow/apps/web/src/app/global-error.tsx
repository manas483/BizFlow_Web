'use client';
import { useEffect } from 'react';

// Using console.error directly since this is client-side. 
// A production APM like Sentry would intercept this.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Fatal React Rendering Error Caught in Boundary:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#e11d48' }}>Critical Application Error</h1>
          <p style={{ color: '#4b5563', marginBottom: '2rem' }}>
            We encountered an unexpected error. Our engineering team has been notified.
          </p>
          <button 
            onClick={() => reset()}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
