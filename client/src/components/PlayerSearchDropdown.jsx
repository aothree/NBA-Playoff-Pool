import React, { useState, useRef, useEffect } from 'react';

/**
 * Searchable player dropdown.
 * NOT a plain select — shows a text input for filtering, then a dropdown list.
 * User must click a player from the list (not free-text).
 */
export default function PlayerSearchDropdown({ players, value, onChange, disabled }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Keep query in sync with external value
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const filtered = query.trim().length === 0
    ? players
    : players.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.team_name.toLowerCase().includes(query.toLowerCase())
      );

  const handleSelect = (player) => {
    setQuery(player.name);
    onChange(player.name);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    // Clear the actual value when typing (force re-selection)
    if (onChange) onChange('');
    setOpen(true);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        // If the query doesn't match any player, clear it
        const match = players.find(p => p.name.toLowerCase() === query.toLowerCase());
        if (!match) {
          setQuery('');
          onChange('');
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [query, players, onChange]);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        className="input"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        placeholder="Search player..."
        disabled={disabled}
        autoComplete="off"
      />
      {open && !disabled && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {filtered.map((player) => (
            <button
              key={player.id}
              type="button"
              className="w-full text-left px-4 py-2.5 hover:bg-gray-700 text-sm transition-colors border-b border-gray-700 last:border-0"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(player);
              }}
            >
              <span className="text-white font-medium">{player.name}</span>
              <span className="text-gray-400 ml-2 text-xs">({player.team_name})</span>
            </button>
          ))}
        </div>
      )}
      {open && !disabled && filtered.length === 0 && query.trim() && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl px-4 py-3 text-sm text-gray-400">
          No players found
        </div>
      )}
    </div>
  );
}
