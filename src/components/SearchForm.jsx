import { useState } from 'react';
import { MAX_ARTIST_COUNT } from '../searchQuery';

export default function SearchForm({ onSearch, error }) {
  const [username, setUsername] = useState('');
  const [timePeriod, setTimePeriod] = useState('7day');
  const [artistCount, setArtistCount] = useState(5);

  const submitSearch = () => onSearch({ username, timePeriod, artistCount });
  const handleKeyPress = event => {
    if (event.key === 'Enter') submitSearch();
  };

  return (
    <div className="mb-4">
      <label className="form-label">LastFM Username:</label>
      <input
        type="text"
        className="form-control"
        value={username}
        required
        onChange={event => setUsername(event.target.value)}
        onKeyPress={handleKeyPress}
      />

      <label className="form-label mt-3">Time Period:</label>
      <select
        className="form-select"
        value={timePeriod}
        onChange={event => setTimePeriod(event.target.value)}
      >
        <option value="7day">Last 7 Days</option>
        <option value="1month">Last Month</option>
        <option value="3month">Last 3 Months</option>
        <option value="6month">Last 6 Months</option>
        <option value="12month">Last Year</option>
        <option value="overall">Overall</option>
      </select>

      <label className="form-label mt-3">Number of Artists:</label>
      <input
        type="number"
        className="form-control"
        value={artistCount}
        min={1}
        max={MAX_ARTIST_COUNT}
        step={1}
        required
        aria-describedby="artist-count-help"
        onChange={event => setArtistCount(event.target.value)}
      />
      <div className="form-text" id="artist-count-help">
        Choose between 1 and {MAX_ARTIST_COUNT} artists.
      </div>

      <button className="btn btn-primary mt-3" onClick={submitSearch}>
        Get Top Artists
      </button>

      {error && (
        <div className="alert alert-danger mt-3" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
