import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';

const navItems = [
  { path: '/', label: 'Token dashboard', description: 'Balances & transfers', icon: DashboardRoundedIcon },
  { path: '/mint', label: 'Mint token', description: 'Issue programmable money', icon: AddCircleRoundedIcon },
  { path: '/spending-conditions', label: 'Spending conditions', description: 'Configure proof rules', icon: RuleRoundedIcon },
];

export default function Navigation({ onNavigate }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Stack spacing={0.8} sx={{ mt: 1 }}>
      {navItems.map(({ path, label, description, icon: Icon }) => {
        const active = location.pathname === path;
        return (
          <Button
            key={path}
            onClick={() => { navigate(path); onNavigate?.(); }}
            aria-current={active ? 'page' : undefined}
            startIcon={<Icon />}
            sx={theme => ({
              justifyContent: 'flex-start', alignItems: 'center', textAlign: 'left', px: 1.5, py: 1.15,
              minHeight: 58, color: active ? 'primary.main' : 'text.primary',
              bgcolor: active ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.09) : 'transparent', border: '1px solid',
              borderColor: active ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.13) : 'transparent',
              '&:hover': { bgcolor: active ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.13) : theme.palette.action.hover },
              '& .MuiButton-startIcon': { mr: 1.4 },
            })}
          >
            <Box>
              <Typography variant="body2" fontWeight={750} lineHeight={1.25}>{label}</Typography>
              <Typography variant="caption" color="text.secondary" lineHeight={1.2}>{description}</Typography>
            </Box>
          </Button>
        );
      })}
    </Stack>
  );
}
