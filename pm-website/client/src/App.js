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
import TokenIcon from '@mui/icons-material/Token';
import SettingsIcon from '@mui/icons-material/Settings';
import ListIcon from '@mui/icons-material/List';

// Navigation component inside App.js
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
      icon: <TokenIcon />,
    },
    {
      path: '/spending-conditions',
      label: 'Add Spending Conditions',
      icon: <SettingsIcon />,
    }
  ];

  return (
    <Box sx={{ p: 2, backgroundColor: '#f9f9f9', borderBottom: '1px solid #ddd' }}>
      <Stack 
        direction="row" 
        spacing={2} 
        justifyContent="center"
        sx={{ flexWrap: 'wrap', gap: 2 }}
      >
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant={location.pathname === item.path ? 'contained' : 'outlined'}
            color="primary"
            startIcon={item.icon}
            onClick={() => navigate(item.path)}
            sx={{ minWidth: 180 }}
          >
            {item.label}
          </Button>
        ))}
      </Stack>
    </Box>
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
      
      {/* Navigation */}
      <Navigation />
      
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