import React, { useRef } from 'react';
import { useMetaMask } from './hooks/useMetaMask';
import CallContract from './components/CallContract';
import TokenList from './components/TokenList';
import { useContract } from './hooks/useContract';

// Material UI imports
import { AppBar, Toolbar, Typography, Button, Container, Box, Paper } from '@mui/material';

function App() {
  const { account, connect } = useMetaMask();
  const { staticContract } = useContract();
  const address_string = account && typeof account === 'object' ? account.address : account;

  // Create a ref for TokenList
  const tokenListRef = useRef();

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            PM Website
          </Typography>
          {!account ? (
            <Button color="inherit" variant="outlined" onClick={connect}>
              Connect MetaMask
            </Button>
          ) : (
            <Typography variant="body1" sx={{ ml: 2 }}>
              Connected: {address_string}
            </Typography>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <TokenList ref={tokenListRef} />
        </Paper>
        <Paper elevation={2} sx={{ p: 3 }}>
          <CallContract tokenListRef={tokenListRef} />
        </Paper>
      </Container>
    </Box>
  );
}

export default App;