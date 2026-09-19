import { render, screen } from '@testing-library/react';
import App from './App';

describe('Programmable Money application shell', () => {
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
});
