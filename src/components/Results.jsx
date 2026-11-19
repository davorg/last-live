import { useRef } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import downloadImage from '../downloadImage';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Results({ artists, seenArtists }) {
  const sectionRef = useRef(null);
  const seenCount = artists.filter(artist => seenArtists[artist.name]).length;
  const percentage = artists.length === 0 ? 0 : ((seenCount / artists.length) * 100).toFixed(2);
  const data = {
    labels: ['Seen', 'Not Seen'],
    datasets: [
      {
        data: [seenCount, artists.length - seenCount],
        backgroundColor: ['#4caf50', '#f44336'],
        hoverBackgroundColor: ['#66bb6a', '#e57373'],
      },
    ],
  };

  return (
    <div className="mt-4 results-section" ref={sectionRef}>
      <h3>Results</h3>
      <p>
        You have seen {percentage}% of your top {artists.length} artists live.
      </p>
      <div className="pie-chart-placeholder">
        <Pie data={data} />
      </div>
      <button
        className="btn btn-secondary mt-3"
        onClick={() => downloadImage(sectionRef.current, 'last-live-results.png')}
      >
        Share Results
      </button>
    </div>
  );
}
