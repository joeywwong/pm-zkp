import React, { useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useMetaMask } from './hooks/useMetaMask';
import CallContract from './components/CallContract';
import TokenList from './components/TokenList';
import { useContract } from './hooks/useContract';

// Import the new page components
import TokenListPage from './pages/TokenListPage';
import MintTokenPage from './pages/MintTokenPage';
import SpendingConditionPage from './pages/SpendingConditionPage';

// Material UI imports
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Container, 
  Box, 
  Paper,
  Stack
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
// import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ListIcon from '@mui/icons-material/List';

// Navigation component now integrated into the AppBar
function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      path: '/',
      label: 'Token List',
      icon: <ListIcon />,
    },
    {
      path: '/mint',
      label: 'Mint Token',
      icon: <MonetizationOnIcon />,
    },
    {
      path: '/spending-conditions',
      label: 'Add Spending Conditions',
      icon: <AddCircleOutlineIcon />,
    }
  ];

  return (
    <Stack 
      direction="row" 
      spacing={1} 
      sx={{ ml: 2 }}
    >
      {navItems.map((item) => (
        <Button
          key={item.path}
          variant={location.pathname === item.path ? 'contained' : 'text'}
          color={location.pathname === item.path ? 'secondary' : 'inherit'}
          startIcon={item.icon}
          onClick={() => navigate(item.path)}
          sx={{ 
            minWidth: 120,
            color: 'white',
            '&.MuiButton-contained': {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
              }
            }
          }}
        >
          {item.label}
        </Button>
      ))}
    </Stack>
  );
}

function AppContent() {
  const { account, connect } = useMetaMask();
  const { staticContract } = useContract();
  const address_string = account && typeof account === 'object' ? account.address : account;
  
  // Create a ref for TokenList
  const tokenListRef = useRef();

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6">
            PM Website
          </Typography>
          
          {/* Navigation in the center */}
          <Navigation />
          
          {/* Connection status/button on the right */}
          {!account ? (
            <Button color="inherit" variant="outlined" onClick={connect}>
              Connect MetaMask
            </Button>
          ) : (
            <Typography variant="body1">
              Connected: {address_string}
            </Typography>
          )}
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Routes>
          <Route 
            path="/" 
            element={
              <Paper elevation={2} sx={{ p: 3 }}>
                <TokenList ref={tokenListRef} />
              </Paper>
            } 
          />
          <Route 
            path="/mint" 
            element={<MintTokenPage tokenListRef={tokenListRef} />} 
          />
          <Route 
            path="/spending-conditions" 
            element={<SpendingConditionPage tokenListRef={tokenListRef} />} 
          />
        </Routes>
      </Container>
    </Box>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;