import React, { useState, useEffect } from 'react';

export default function ReadJsonLD({ onData }) {
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizeUrl = url =>
    url.startsWith('ipfs://')
      ? 'https://ipfs.io/ipfs/' + url.slice(7)
      : url;

  useEffect(() => {
    if (!link.trim()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const url = normalizeUrl(link.trim());
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) onData(json);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [link]);

  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium">Load JSON‑LD:</label>
      <input
        type="text"
        className="w-full p-2 border rounded"
        placeholder="https://... or ipfs://..."
        value={link}
        onChange={e => setLink(e.target.value)}
      />
      {loading && (
        <div className="mt-2 flex items-center">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
          <span className="ml-2">Loading JSON…</span>
        </div>
      )}
      {error && <p className="text-red-500 mt-2">Error: {error}</p>}
    </div>
  );
}