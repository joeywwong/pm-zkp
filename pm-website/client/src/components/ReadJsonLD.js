import React, { useEffect, useRef, useState } from 'react';
import TextField from '@mui/material/TextField';

export default function ReadJsonLD({ url, setUrl, onData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastJsonRef = useRef(null);
  const lastUrlRef = useRef('');

  const normalizeUrl = url =>
    url.startsWith('ipfs://')
      ? 'https://ipfs.io/ipfs/' + url.slice(7)
      : url;

  useEffect(() => {
    if (!url?.trim() || url === lastUrlRef.current) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const fetchUrl = normalizeUrl(url.trim());
    fetch(fetchUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (!cancelled) {
          // Only call onData if JSON actually changed
          if (JSON.stringify(json) !== JSON.stringify(lastJsonRef.current)) {
            lastJsonRef.current = json;
            onData(json);
          }
          lastUrlRef.current = url;
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // Only refetch if url changes, not onData
    // eslint-disable-next-line
  }, [url]);

  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium">Load JSON‑LD:</label>
      <TextField
        label="JSON-LD URL"
        value={url}
        onChange={e => setUrl(e.target.value)}
        fullWidth
        margin="normal"
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