import { useEffect, useRef, useState } from 'react';
import { normalizeSearchQuery } from './searchQuery';

export default function useTopArtists(client) {
  const activeRequest = useRef(null);
  const [request, setRequest] = useState({
    status: 'idle',
    error: null,
    result: { artists: [], query: null },
  });

  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);

  const search = async query => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setRequest({ status: 'loading', error: null, result: { artists: [], query: null } });

    try {
      const submittedQuery = normalizeSearchQuery(query);
      const artists = await client.getTopArtists(submittedQuery, { signal: controller.signal });
      // Aborting saves work; this guard also protects against clients that finish
      // after cancellation, including responses already being processed.
      if (activeRequest.current !== controller) return;
      setRequest({
        status: artists.length > 0 ? 'success' : 'empty',
        error: null,
        result: { artists, query: submittedQuery },
      });
    } catch (error) {
      if (activeRequest.current !== controller) return;
      setRequest({
        status: 'error',
        error: error?.message || 'The search failed. Please try again.',
        result: { artists: [], query: null },
      });
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  };

  return { ...request, search };
}
