import React, { useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import { useMetaMask } from './hooks/useMetaMask';
import Navigation from './components/Navigation';
import TokenList from './components/TokenList';
import MintTokenPage from './pages/MintTokenPage';
import SpendingConditionPage from './pages/SpendingConditionPage';

const drawerWidth = 272;

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#5B4FE9', dark: '#4338CA', light: '#8077F4', contrastText: '#FFFFFF' },
    secondary: { main: '#18A999' },
    background: { default: '#F5F7FB', paper: '#FFFFFF' },
    text: { primary: '#182135', secondary: '#687086' },
    success: { main: '#16886F' },
    warning: { main: '#B7791F' },
    error: { main: '#D84A5F' },
    divider: '#E5E8F0',
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
    h1: { fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 750, letterSpacing: '-0.04em' },
    h2: { fontSize: 'clamp(1.65rem, 3vw, 2.25rem)', fontWeight: 750, letterSpacing: '-0.035em' },
    h3: { fontSize: '1.4rem', fontWeight: 720, letterSpacing: '-0.02em' },
    h4: { fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.015em' },
    h5: { fontSize: '1rem', fontWeight: 700 },
    button: { fontWeight: 700, letterSpacing: 0, textTransform: 'none' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, minHeight: 42, paddingInline: 18 },
        containedPrimary: {
          boxShadow: '0 8px 22px rgba(91, 79, 233, 0.2)',
          '&:hover': { boxShadow: '0 10px 26px rgba(91, 79, 233, 0.28)' },
        },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: { styleOverrides: { root: { border: '1px solid #E5E8F0', boxShadow: '0 12px 34px rgba(30, 39, 65, 0.06)' } } },
    MuiTextField: { defaultProps: { variant: 'outlined' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          borderRadius: 10,
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#9CA3C2' },
        },
        notchedOutline: { borderColor: '#D9DDE8' },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 8 } } },
  },
});

function Brand() {
  return (
    <Stack direction="row" spacing={1.4} alignItems="center">
      <Box sx={{ width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center', color: 'white', background: 'linear-gradient(145deg, #6558F5 5%, #3E35B8 100%)', boxShadow: '0 8px 18px rgba(91,79,233,.24)' }}>
        <ShieldRoundedIcon fontSize="small" />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>Programmable Money</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>ZKP control layer</Typography>
      </Box>
    </Stack>
  );
}

function WalletControl({ account, connect }) {
  const [connectError, setConnectError] = useState('');
  const address = account && typeof account === 'object' ? account.address : account;
  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';

  const handleConnect = async () => {
    setConnectError('');
    try { await connect(); } catch (error) { setConnectError(error?.message || 'Could not connect wallet'); }
  };

  if (!address) {
    return (
      <Tooltip title={connectError || 'Connect your wallet to use on-chain actions'}>
        <Button onClick={handleConnect} variant="contained" startIcon={<AccountBalanceWalletRoundedIcon />}>Connect wallet</Button>
      </Tooltip>
    );
  }

  return (
    <Stack direction="row" spacing={1.2} alignItems="center">
      <Chip size="small" label="Connected" color="success" variant="outlined" sx={{ display: { xs: 'none', sm: 'flex' }, bgcolor: alpha(theme.palette.success.main, 0.05) }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '6px 10px 6px 6px', border: '1px solid', borderColor: 'divider', borderRadius: 2.5, bgcolor: 'background.paper' }}>
        <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.main', fontSize: 13, fontWeight: 800 }}>{address.slice(2, 4).toUpperCase()}</Avatar>
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.1}>MetaMask</Typography>
          <Typography variant="body2" fontWeight={700} lineHeight={1.3}>{shortAddress}</Typography>
        </Box>
      </Box>
    </Stack>
  );
}

function AppContent() {
  const { account, connect } = useMetaMask();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const tokenListRef = useRef();

  const routeMeta = {
    '/': ['Token dashboard', 'Review balances, transfer assets, and monitor proof requirements.'],
    '/mint': ['Mint token', 'Issue programmable assets to a wallet on the connected network.'],
    '/spending-conditions': ['Add spending conditions', 'Define a credential rule and attach it to a token transfer.'],
  };
  const [pageTitle, pageDescription] = routeMeta[location.pathname] || routeMeta['/'];

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2.5 }}>
      <Brand />
      <Box sx={{ mt: 4 }}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, fontWeight: 800, letterSpacing: '.1em' }}>Workspace</Typography>
        <Navigation onNavigate={() => setMobileOpen(false)} />
      </Box>
      <Box sx={{ mt: 'auto', p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.06), border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.12) }}>
        <Stack direction="row" spacing={1} alignItems="center" mb={0.8}>
          <ShieldRoundedIcon color="primary" fontSize="small" />
          <Typography variant="body2" fontWeight={800}>Privacy-aware assets</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" lineHeight={1.5}>Transfers can enforce zero-knowledge credential conditions without exposing private data.</Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" color="inherit" sx={{ ml: { md: `${drawerWidth}px` }, width: { md: `calc(100% - ${drawerWidth}px)` }, borderBottom: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: alpha('#FFFFFF', 0.92), backdropFilter: 'blur(14px)' }}>
        <Toolbar sx={{ minHeight: { xs: 68, md: 76 }, px: { xs: 2, sm: 3.5 } }}>
          <IconButton onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' }, mr: 1 }} aria-label="Open navigation"><MenuRoundedIcon /></IconButton>
          <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
            <Typography variant="h4">{pageTitle}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{pageDescription}</Typography>
          </Box>
          <Box sx={{ display: { md: 'none' }, minWidth: 0, flex: 1 }}><Typography fontWeight={800} noWrap>{pageTitle}</Typography></Box>
          <Box sx={{ ml: 'auto' }}><WalletControl account={account} connect={connect} /></Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" aria-label="Main navigation">
        <Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, borderRight: '1px solid', borderColor: 'divider', bgcolor: '#FBFCFF' } }} open>{drawer}</Drawer>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth, maxWidth: '86vw' } }}>{drawer}</Drawer>
      </Box>

      <Box component="main" sx={{ ml: { md: `${drawerWidth}px` }, pt: { xs: '68px', md: '76px' }, minHeight: '100vh' }}>
        <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3.5, lg: 5 }, py: { xs: 3, md: 4.5 } }}>
          <Box sx={{ display: { md: 'none' }, mb: 3 }}>
            <Typography variant="h2">{pageTitle}</Typography>
            <Typography color="text.secondary" mt={0.5}>{pageDescription}</Typography>
          </Box>
          <Routes>
            <Route path="/" element={<TokenList ref={tokenListRef} />} />
            <Route path="/mint" element={<MintTokenPage tokenListRef={tokenListRef} />} />
            <Route path="/spending-conditions" element={<SpendingConditionPage tokenListRef={tokenListRef} />} />
          </Routes>
        </Container>
      </Box>
    </Box>
  );
}

function App() {
  return <ThemeProvider theme={theme}><CssBaseline /><Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppContent /></Router></ThemeProvider>;
}

export default App;
