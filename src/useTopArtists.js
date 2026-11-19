import { useState } from 'react';

export default function useTopArtists(client) {
  const [request, setRequest] = useState({
    status: 'idle',
    error: null,
    result: { artists: [], query: null },
  });

  const search = async query => {
    const submittedQuery = { ...query };
    setRequest(previous => ({ ...previous, status: 'loading', error: null }));

    try {
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
