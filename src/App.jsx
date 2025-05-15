import { useState, useEffect } from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import html2canvas from 'html2canvas';

ChartJS.register(ArcElement, Tooltip, Legend);

const API_KEY = import.meta.env.VITE_LASTFM_API_KEY;

function App() {
  const [username, setUsername] = useState('');
  const [timePeriod, setTimePeriod] = useState('7day');
  const [artistCount, setArtistCount] = useState(5);
  const [artists, setArtists] = useState([]);
  const [seenArtists, setSeenArtists] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    const storedSeenArtists = localStorage.getItem('seenArtists');
    if (storedSeenArtists) {
      setSeenArtists(JSON.parse(storedSeenArtists));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('seenArtists', JSON.stringify(seenArtists));
  }, [seenArtists]);

  const fetchArtists = async () => {
    try {
      setError(null); // Clear any previous errors
      const response = await fetch(
        `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${username}&period=${timePeriod}&limit=${artistCount}&api_key=${API_KEY}&format=json`
      );

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.topartists || !data.topartists.artist) {
        throw new Error('Invalid data format received from API');
      }

      setArtists(data.topartists.artist);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCheckboxChange = (artistName) => {
    setSeenArtists((prev) => ({
      ...prev,
      [artistName]: !prev[artistName],
    }));
  };

  const calculateSeenPercentage = () => {
    const seenCount = Object.keys(seenArtists).filter(
      (artistName) => seenArtists[artistName]
    ).length;
    const totalArtists = artists.length;
    if (totalArtists === 0) return 0; // Avoid division by zero
    return ((seenCount / totalArtists) * 100).toFixed(2);
  };

  const renderPieChart = () => {
    const seenCount = artists.filter((artist) => seenArtists[artist.name]).length;
    const notSeenCount = artists.length - seenCount;

    const data = {
      labels: ['Seen', 'Not Seen'],
      datasets: [
        {
          data: [seenCount, notSeenCount],
          backgroundColor: ['#4caf50', '#f44336'],
          hoverBackgroundColor: ['#66bb6a', '#e57373'],
        },
      ],
    };

    return <Pie data={data} />;
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      fetchArtists();
    }
  };

  const captureResultsAsImage = () => {
    const resultsSection = document.querySelector('.results-section');
    if (resultsSection) {
      html2canvas(resultsSection).then((canvas) => {
        const link = document.createElement('a');
        link.download = 'last-live-results.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    }
  };

  return (
    <div className="container mt-4">
      <h1 className="text-center">LastFM Top Artists</h1>

      {/* Form Section */}
      <div className="mb-4">
        <label className="form-label">LastFM Username:</label>
        <input
          type="text"
          className="form-control"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyPress={handleKeyPress}
        />

        <label className="form-label mt-3">Time Period:</label>
        <select
          className="form-select"
          value={timePeriod}
          onChange={(e) => setTimePeriod(e.target.value)}
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
          onChange={(e) => setArtistCount(e.target.value)}
        />

        <button className="btn btn-primary mt-3" onClick={fetchArtists}>
          Get Top Artists
        </button>
      </div>

      {/* Artists List Section */}
      {artists.length > 0 && (
        <div>
          <h2>Top Artists</h2>
          <ul className="list-group">
            {artists.map((artist) => (
              <li
                key={artist.name}
                className={`list-group-item d-flex justify-content-between align-items-center ${
                  seenArtists[artist.name] ? 'bg-success text-white' : 'bg-danger text-white'
                }`}
              >
                {artist.name}
                <input
                  type="checkbox"
                  checked={!!seenArtists[artist.name]}
                  onChange={() => handleCheckboxChange(artist.name)}
                />
              </li>
            ))}
          </ul>

          {/* Results Section */}
          <div className="mt-4 results-section">
            <h3>Results</h3>
            <p>
              You have seen {calculateSeenPercentage()}% of your top {artists.length} artists live.
            </p>
            <div className="pie-chart-placeholder">
              {renderPieChart()}
            </div>
            <button className="btn btn-secondary mt-3" onClick={captureResultsAsImage}>
              Share Results
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="alert alert-danger mt-3" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

export default App;
