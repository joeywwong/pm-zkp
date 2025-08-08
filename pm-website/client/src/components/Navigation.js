import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import TokenIcon from '@mui/icons-material/Token';
import SettingsIcon from '@mui/icons-material/Settings';

export default function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      path: '/',
      label: 'Token List',
      icon: <TokenIcon />,
      description: 'View and manage your tokens'
    },
    {
      path: '/mint',
      label: 'Mint Token',
      icon: <TokenIcon />,
      description: 'Create new tokens'
    },
    {
      path: '/spending-conditions',
      label: 'Spending Conditions',
      icon: <SettingsIcon />,
      description: 'Add spending conditions to tokens'
    }
  ];

  return (
    <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
      <Typography variant="h4" gutterBottom align="center" sx={{ mb: 3 }}>
        Programmable Money Dashboard
      </Typography>
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
            sx={{
              minWidth: 200,
              height: 56,
              flexDirection: 'column',
              alignItems: 'center',
              '& .MuiButton-startIcon': {
                margin: 0,
                marginBottom: 0.5
              }
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="button" display="block">
                {item.label}
              </Typography>
              <Typography variant="caption" display="block" sx={{ opacity: 0.7, fontSize: '0.65rem' }}>
                {item.description}
              </Typography>
            </Box>
          </Button>
        ))}
      </Stack>
    </Box>
  );
}