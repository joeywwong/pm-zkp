import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

describe('Programmable Money application shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themePreference;
  });

  test('renders the token dashboard and wallet connection state', () => {
    render(<App />);

    expect(screen.getAllByText('Token dashboard').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /connect your wallet/i })).toBeInTheDocument();
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
  });

  test('exposes the three existing application workflows', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /token dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mint token/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /spending conditions/i })).toBeInTheDocument();
  });

  test('persists an explicit color theme preference', async () => {
    render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Dark theme' })[0]);

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      expect(document.documentElement).toHaveAttribute('data-theme-preference', 'dark');
      expect(window.localStorage.getItem('pm-theme-mode')).toBe('dark');
    });
  });

  test('system preference follows operating system theme changes', async () => {
    let listener;
    const media = {
      matches: false,
      addEventListener: jest.fn((event, callback) => { if (event === 'change') listener = callback; }),
      removeEventListener: jest.fn(),
    };
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn(() => media);

    render(<App />);
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-theme', 'light'));

    act(() => listener({ matches: true }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
      expect(document.documentElement).toHaveAttribute('data-theme-preference', 'system');
    });

    window.matchMedia = originalMatchMedia;
  });
});
