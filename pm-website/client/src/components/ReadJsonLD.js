import React, { useEffect, useRef, useState } from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';

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
    <Box>
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
                label="Credential context URL"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <LinkRoundedIcon fontSize="small" color="action" sx={{ mr: 1 }} />,
                  endAdornment: loading ? <CircularProgress size={20} /> : (showClear ? params.InputProps.endAdornment : null),
                }}
                placeholder="Select the sample context or enter a public JSON-LD URL"
                helperText="The context must remain publicly accessible so proof requests can resolve its schema."
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
      {loading && <Typography variant="caption" color="text.secondary" display="block" mt={1}>Loading credential context…</Typography>}
      {error && <Alert severity="error" sx={{ mt: 1.5 }}>Could not load this credential context: {error}</Alert>}
    </Box>
  );
}
