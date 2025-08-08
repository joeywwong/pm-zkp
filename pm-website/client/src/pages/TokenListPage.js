import React from 'react';
import TokenList from '../components/TokenList';
import { Box, Typography } from '@mui/material';

export default function TokenListPage({ tokenListRef }) {
  return (
    <Box sx={{ p: 2 }}>
      <TokenList ref={tokenListRef} />
    </Box>
  );
}