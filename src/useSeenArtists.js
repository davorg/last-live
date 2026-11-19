import { useEffect, useState } from 'react';

const STORAGE_KEY = 'last-live:v1:seenArtists';
const LEGACY_KEY = 'seenArtists';

function readSeenArtists() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    const marks = stored === null ? {} : JSON.parse(stored);
    if (
      marks === null || typeof marks !== 'object' || Array.isArray(marks) ||
      !Object.values(marks).every(value => typeof value === 'boolean')
    ) {
      throw new Error('Invalid saved marks');
    }

    // Artist names can also be Object.prototype property names.
    return { marks: Object.assign(Object.create(null), marks), canSave: true, warning: null };
  } catch {
    return {
      marks: Object.create(null),
      canSave: false,
      warning: 'Saved seen-artist marks could not be loaded. Changes will only last for this visit.',
    };
  }
}

export default function useSeenArtists() {
  // Read before the first save. Strict Mode can repeat this initialiser safely:
  // it never changes storage, including when migrating from the legacy key.
  const [initial] = useState(readSeenArtists);
  const [seenArtists, setSeenArtists] = useState(initial.marks);
  const [storageWarning, setStorageWarning] = useState(initial.warning);

  /* eslint-disable react-hooks/set-state-in-effect -- Surface storage-write success/failure in the UI. */
  useEffect(() => {
    // Preserve unreadable data instead of overwriting it with an empty map.
    if (!initial.canSave) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seenArtists));
      // The old key is intentionally retained as a recovery copy. Once the
      // versioned key is saved, subsequent visits prefer it over that backup.
      setStorageWarning(null);
    } catch {
      setStorageWarning('Your seen-artist marks could not be saved. Changes may be lost when you leave this page.');
    }
  }, [seenArtists, initial]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleSeenArtist = artistName => {
    setSeenArtists(previous => ({
      __proto__: null,
      ...previous,
      [artistName]: !previous[artistName],
    }));
  };

  return { seenArtists, toggleSeenArtist, storageWarning };
}
