import useSeenArtists from './useSeenArtists';
import useTopArtists from './useTopArtists';
import { createLastFmClient } from './api/lastfm';
import SearchForm from './components/SearchForm';
import ArtistList from './components/ArtistList';
import Results from './components/Results';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { version } from '../package.json';

const lastfm = createLastFmClient({ apiKey: import.meta.env.VITE_LASTFM_API_KEY });

function App() {
  const { result, error, search } = useTopArtists(lastfm);
  const { seenArtists, toggleSeenArtist, storageWarning } = useSeenArtists();

  return (
    <div className="container mt-4">
      <h1 className="text-center">LastFM Top Artists</h1>

      {storageWarning && (
        <div className="alert alert-warning mt-3" role="status">
          {storageWarning}
        </div>
      )}

      <SearchForm onSearch={search} />

      {result.artists.length > 0 && (
        <div>
          <ArtistList artists={result.artists} seenArtists={seenArtists} onToggle={toggleSeenArtist} />
          <Results artists={result.artists} seenArtists={seenArtists} />
        </div>
      )}

      {error && (
        <div className="alert alert-danger mt-3" role="alert">
          {error}
        </div>
      )}

      <footer className="mt-4 text-body-secondary">
        <small>Last Live v{version}</small>
      </footer>
    </div>
  );
}

export default App;
