import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, alpha, useTheme } from '@mui/material/styles';
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import BrightnessAutoRoundedIcon from '@mui/icons-material/BrightnessAutoRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { MetaMaskProvider, useMetaMask } from './hooks/useMetaMask';
import Navigation from './components/Navigation';
import TokenList from './components/TokenList';
import MintTokenPage from './pages/MintTokenPage';
import SpendingConditionPage from './pages/SpendingConditionPage';

const drawerWidth = 272;
const THEME_STORAGE_KEY = 'pm-theme-mode';
const themeOptions = [
  { value: 'system', label: 'System', icon: BrightnessAutoRoundedIcon },
  { value: 'light', label: 'Light', icon: LightModeRoundedIcon },
  { value: 'dark', label: 'Dark', icon: DarkModeRoundedIcon },
];

const createAppTheme = mode => createTheme({
  palette: {
    mode,
    primary: mode === 'dark'
      ? { main: '#9188FF', dark: '#756AF4', light: '#B5AFFF', contrastText: '#111426' }
      : { main: '#5B4FE9', dark: '#4338CA', light: '#8077F4', contrastText: '#FFFFFF' },
    secondary: { main: mode === 'dark' ? '#48C9B9' : '#18A999' },
    background: mode === 'dark'
      ? { default: '#0E1220', paper: '#171C2D' }
      : { default: '#F5F7FB', paper: '#FFFFFF' },
    text: mode === 'dark'
      ? { primary: '#F1F3FA', secondary: '#A7B0C5' }
      : { primary: '#182135', secondary: '#687086' },
    success: { main: mode === 'dark' ? '#45C6A1' : '#16886F' },
    warning: { main: mode === 'dark' ? '#E4B35F' : '#B7791F' },
    error: { main: mode === 'dark' ? '#F17386' : '#D84A5F' },
    divider: mode === 'dark' ? '#293148' : '#E5E8F0',
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
          boxShadow: mode === 'dark' ? '0 8px 22px rgba(95, 82, 228, 0.24)' : '0 8px 22px rgba(91, 79, 233, 0.2)',
          '&:hover': { boxShadow: mode === 'dark' ? '0 10px 26px rgba(95, 82, 228, 0.34)' : '0 10px 26px rgba(91, 79, 233, 0.28)' },
        },
      },
    },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: { styleOverrides: { root: { border: `1px solid ${mode === 'dark' ? '#293148' : '#E5E8F0'}`, boxShadow: mode === 'dark' ? '0 12px 34px rgba(0, 0, 0, 0.22)' : '0 12px 34px rgba(30, 39, 65, 0.06)' } } },
    MuiTextField: { defaultProps: { variant: 'outlined' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'dark' ? '#151A2A' : '#FFFFFF',
          borderRadius: 10,
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: mode === 'dark' ? '#606A86' : '#9CA3C2' },
        },
        notchedOutline: { borderColor: mode === 'dark' ? '#343D57' : '#D9DDE8' },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 8 } } },
  },
});

function getSystemTheme() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSavedThemePreference() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return themeOptions.some(option => option.value === saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

function ThemeModeControl({ value, onChange }) {
  const theme = useTheme();

  return (
    <ToggleButtonGroup
      exclusive
      value={value}
      onChange={(_, nextMode) => { if (nextMode) onChange(nextMode); }}
      aria-label="Color theme"
      size="small"
      sx={{
        p: '3px',
        gap: '2px',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2.5,
        bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.07 : 0.035),
        '& .MuiToggleButtonGroup-grouped': {
          gap: 0.65,
          minWidth: 34,
          minHeight: 32,
          px: 0.8,
          py: 0.45,
          border: 0,
          borderRadius: '8px !important',
          color: 'text.secondary',
          textTransform: 'none',
          fontWeight: 700,
          '&.Mui-selected': {
            color: 'text.primary',
            bgcolor: 'background.paper',
            boxShadow: theme.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,.3)' : '0 2px 8px rgba(31,38,60,.1)',
            '&:hover': { bgcolor: 'background.paper' },
          },
        },
      }}
    >
      {themeOptions.map(({ value: optionValue, label, icon: Icon }) => (
        <ToggleButton key={optionValue} value={optionValue} aria-label={`${label} theme`}>
          <Icon sx={{ fontSize: 18 }} />
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

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
  const theme = useTheme();
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
      <Tooltip title={connectError || 'Change MetaMask account'}>
        <Box component="button" type="button" aria-label="Change MetaMask account" onClick={handleConnect} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: '6px 10px 6px 6px', border: '1px solid', borderColor: 'divider', borderRadius: 2.5, bgcolor: 'background.paper', color: 'text.primary', font: 'inherit', cursor: 'pointer' }}>
          <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.main', fontSize: 13, fontWeight: 800 }}>{address.slice(2, 4).toUpperCase()}</Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left' }}>
            <Typography variant="caption" color="text.secondary" display="block" lineHeight={1.1}>MetaMask</Typography>
            <Typography variant="body2" fontWeight={700} lineHeight={1.3}>{shortAddress}</Typography>
          </Box>
        </Box>
      </Tooltip>
    </Stack>
  );
}

function AppContent({ themePreference, onThemePreferenceChange }) {
  const theme = useTheme();
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
      <Box sx={{ mt: 'auto', p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.06), border: '1px solid', borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12) }}>
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
      <AppBar position="fixed" color="inherit" sx={{ ml: { md: `${drawerWidth}px` }, width: { md: `calc(100% - ${drawerWidth}px)` }, borderBottom: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: alpha(theme.palette.background.paper, 0.92), backdropFilter: 'blur(14px)' }}>
        <Toolbar sx={{ minHeight: { xs: 68, md: 76 }, px: { xs: 2, sm: 3.5 } }}>
          <IconButton onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' }, mr: 1 }} aria-label="Open navigation"><MenuRoundedIcon /></IconButton>
          <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
            <Typography variant="h4">{pageTitle}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{pageDescription}</Typography>
          </Box>
          <Box sx={{ display: { md: 'none' }, minWidth: 0, flex: 1 }}><Typography fontWeight={800} noWrap>{pageTitle}</Typography></Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ ml: 'auto' }}>
            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <ThemeModeControl value={themePreference} onChange={onThemePreferenceChange} />
            </Box>
            <WalletControl account={account} connect={connect} />
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" aria-label="Main navigation">
        <Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, borderRight: '1px solid', borderColor: 'divider', bgcolor: theme.palette.mode === 'dark' ? '#121727' : '#FBFCFF' } }} open>{drawer}</Drawer>
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
  const [themePreference, setThemePreference] = useState(getSavedThemePreference);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const resolvedTheme = themePreference === 'system' ? systemTheme : themePreference;
  const theme = useMemo(() => createAppTheme(resolvedTheme), [resolvedTheme]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const handleChange = event => setSystemTheme(event.matches ? 'dark' : 'light');
    handleChange(media);
    if (media.addEventListener) media.addEventListener('change', handleChange);
    else media.addListener?.(handleChange);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', handleChange);
      else media.removeListener?.(handleChange);
    };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, themePreference); } catch { /* Storage may be unavailable. */ }
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = themePreference;
    document.documentElement.style.colorScheme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? '#0E1220' : '#F5F7FB');
  }, [resolvedTheme, themePreference]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MetaMaskProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppContent themePreference={themePreference} onThemePreferenceChange={setThemePreference} />
        </Router>
      </MetaMaskProvider>
    </ThemeProvider>
  );
}

export default App;
