import { useState, useEffect } from 'react';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

const SCRIPT_ID = 'google-maps-script';

/**
 * Loads the Google Maps JavaScript API script exactly once per page lifetime.
 * Multiple components can call this hook and they all share the same load state.
 *
 * Respects the VITE_GOOGLE_MAPS_API_KEY environment variable.
 * Libraries loaded: places (optional future use).
 */
export function useGoogleMaps() {
  const [status, setStatus] = useState<LoadStatus>(() => {
    // Already loaded by a previous mount
    if (typeof window !== 'undefined' && window.google?.maps) return 'loaded';
    // Script tag already injected but not yet resolved
    if (typeof document !== 'undefined' && document.getElementById(SCRIPT_ID)) return 'loading';
    return 'idle';
  });

  useEffect(() => {
    // Already fully loaded
    if (window.google?.maps) {
      setStatus('loaded');
      return;
    }

    // Script tag exists — wait for it (another instance is loading)
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      const onLoad = () => setStatus('loaded');
      const onError = () => setStatus('error');
      existing.addEventListener('load', onLoad);
      existing.addEventListener('error', onError);
      return () => {
        existing.removeEventListener('load', onLoad);
        existing.removeEventListener('error', onError);
      };
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

    if (!apiKey || apiKey.trim() === '' || apiKey === 'your_google_maps_api_key_here') {
      console.error(
        '[useGoogleMaps] VITE_GOOGLE_MAPS_API_KEY is not set or still has the placeholder value.'
      );
      setStatus('error');
      return;
    }

    setStatus('loading');

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;

    const onLoad = () => setStatus('loaded');
    const onError = () => {
      console.error('[useGoogleMaps] Failed to load Google Maps JavaScript API.');
      setStatus('error');
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
  }, []);

  return {
    isLoaded: status === 'loaded',
    isLoading: status === 'loading',
    hasError: status === 'error',
    status,
  };
}
