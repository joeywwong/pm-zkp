import React, { useEffect, useRef, useState } from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';

export default function ReadJsonLD({ url, setUrl, onData }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastJsonRef = useRef(null);
  const lastUrlRef = useRef('');
  // Predefined JSON-LD URLs for autocomplete
  const jsonLdOptions = [
    'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json-ld/kyc-v3.json-ld'
  ];

  const normalizeUrl = url =>
    url.startsWith('ipfs://')
      ? 'https://ipfs.io/ipfs/' + url.slice(7)
      : url;

  useEffect(() => {
    if (!url?.trim()) {
      // Clear data when URL is empty
      lastUrlRef.current = '';
      lastJsonRef.current = null;
      setError(null);
      onData(null);
      return;
    }
    if (url === lastUrlRef.current) return;
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
        if (!cancelled) {
          setError(err.message);
          // On error, clear downstream data
          onData(null);
        }
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
      <label className="block mb-1 font-medium">Enter credentials schema URL (JSON‑LD):</label>
      <Autocomplete
        freeSolo
        options={jsonLdOptions}
        // Show suggestions that match the input text
        filterOptions={(options, state) => {
          const inputValue = state.inputValue.trim().toLowerCase();
          if (inputValue === '') {
            return options; // Show all options when input is empty
          }
          return options.filter(option => 
            option.toLowerCase().includes(inputValue)
          );
        }}
        // Remove onOpen and disableOpenOnFocus to allow normal behavior
        value={url}
        onChange={(e, newVal) => {
          setError(null);
          setUrl(newVal || '');
        }}
        onInputChange={(e, newInput) => {
          setError(null);
          setUrl(newInput);
        }}
        renderInput={(params) => {
          const showTriangle = !url;
          const showClear = !!url;
          return (
            <Box sx={{ position: 'relative', width: '100%' }}>
              <TextField
                {...params}
                label="JSON-LD URL"
                fullWidth
                margin="normal"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: null,
                  endAdornment: showClear ? params.InputProps.endAdornment : null,
                }}
                placeholder="Select from list or enter the URL"
              />
              {showTriangle && (
                <Box sx={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" style={{ color: '#888' }} aria-hidden="true" focusable="false">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </Box>
              )}
            </Box>
          );
        }}
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