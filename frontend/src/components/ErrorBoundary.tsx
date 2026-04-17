import React, { ReactNode, useState, useEffect } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

export const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    let errorMessage = "Something went wrong.";
    
    try {
      const firestoreError = JSON.parse(error?.message || "");
      if (firestoreError.error) {
        errorMessage = `Database Error: ${firestoreError.error}`;
      }
    } catch (e) {
      errorMessage = error?.message || errorMessage;
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center bg-slate-50">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Oops!</h1>
        <p className="text-slate-600 mb-6">{errorMessage}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
        >
          Reload Application
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
