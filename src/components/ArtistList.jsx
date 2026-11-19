import { useRef } from 'react';
import downloadImage from '../downloadImage';

export default function ArtistList({ artists, seenArtists, onToggle }) {
  const sectionRef = useRef(null);

  return (
    <div className="artists-table-section" ref={sectionRef}>
      <h2>Top Artists</h2>
      <p>Check the artists you have seen live</p>

      <ul className="list-group">
        {artists.map((artist, index) => (
          <li
            key={artist.name}
            className={`list-group-item d-flex justify-content-between align-items-center ${
              seenArtists[artist.name] ? 'bg-success text-white' : 'bg-danger text-white'
            }`}
          >
            {artist.name} ({parseInt(artist.playcount).toLocaleString()}{index === 0 ? ' scrobbles' : ''})
            <input
              type="checkbox"
              checked={!!seenArtists[artist.name]}
              onChange={() => onToggle(artist.name)}
            />
          </li>
        ))}
      </ul>

      <button
        className="btn btn-secondary mt-3"
        onClick={() => downloadImage(sectionRef.current, 'last-live-artists-table.png')}
      >
        Share Table
      </button>
    </div>
  );
}
