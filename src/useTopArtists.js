import { useState } from 'react';
import { normalizeSearchQuery } from './searchQuery';

export default function useTopArtists(client) {
  const [request, setRequest] = useState({
    status: 'idle',
    error: null,
    result: { artists: [], query: null },
  });

  const search = async query => {
    setRequest(previous => ({ ...previous, status: 'loading', error: null }));

    try {
      const submittedQuery = normalizeSearchQuery(query);
      const artists = await client.getTopArtists(submittedQuery);
      setRequest({
        status: 'success',
        error: null,
        result: { artists, query: submittedQuery },
      });
    } catch (error) {
      setRequest(previous => ({ ...previous, status: 'error', error: error.message }));
    }
  };

  return { ...request, search };
}
