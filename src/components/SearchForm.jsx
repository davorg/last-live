import { useState } from 'react';

export default function SearchForm({ onSearch }) {
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
        onChange={event => setArtistCount(event.target.value)}
      />

      <button className="btn btn-primary mt-3" onClick={submitSearch}>
        Get Top Artists
      </button>
    </div>
  );
}
