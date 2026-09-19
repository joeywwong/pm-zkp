import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MetaMaskProvider, useMetaMask } from './useMetaMask';

function WalletState({ label }) {
  const { account, connect } = useMetaMask();

  return (
    <div>
      <span>{label}: {account || 'disconnected'}</span>
      {label === 'first' && <button onClick={() => connect().catch(() => {})}>Connect</button>}
    </div>
  );
}

function createEthereum(accounts = [], unlocked = true) {
  const listeners = new Map();

  return {
    isMetaMask: true,
    _metamask: { isUnlocked: jest.fn(async () => unlocked) },
    request: jest.fn(async ({ method }) => {
      if (method === 'wallet_requestPermissions') return [{ parentCapability: 'eth_accounts' }];
      if (method === 'eth_requestAccounts') return accounts;
      if (method === 'eth_accounts') return accounts;
      if (method === 'eth_chainId') return '0x1';
      throw new Error(`Unexpected RPC method: ${method}`);
    }),
    on: jest.fn((event, listener) => listeners.set(event, listener)),
    removeListener: jest.fn((event, listener) => {
      if (listeners.get(event) === listener) listeners.delete(event);
    }),
    emit(event, value) {
      listeners.get(event)?.(value);
    },
  };
}

describe('MetaMaskProvider', () => {
  afterEach(() => {
    delete window.ethereum;
  });

  test('starts disconnected even when MetaMask remembers an authorized account', () => {
    const ethereum = createEthereum(['0x1111111111111111111111111111111111111111']);
    window.ethereum = ethereum;

    render(
      <MetaMaskProvider>
        <WalletState label="first" />
      </MetaMaskProvider>
    );

    expect(screen.getByText('first: disconnected')).toBeInTheDocument();
    expect(ethereum.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'wallet_requestPermissions' }));

    act(() => ethereum.emit('accountsChanged', ['0x1111111111111111111111111111111111111111']));

    expect(screen.getByText('first: disconnected')).toBeInTheDocument();
  });

  test('does not display a stale account when MetaMask reports that it is locked', async () => {
    const ethereum = createEthereum(['0x1111111111111111111111111111111111111111'], false);
    window.ethereum = ethereum;

    render(
      <MetaMaskProvider>
        <WalletState label="first" />
      </MetaMaskProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(screen.getByText('first: disconnected')).toBeInTheDocument();
      expect(ethereum._metamask.isUnlocked).toHaveBeenCalled();
    });
  });

  test('shares the connection and follows account changes after connecting', async () => {
    const firstAccount = '0x1111111111111111111111111111111111111111';
    const secondAccount = '0x2222222222222222222222222222222222222222';
    const ethereum = createEthereum([firstAccount]);
    window.ethereum = ethereum;

    render(
      <MetaMaskProvider>
        <WalletState label="first" />
        <WalletState label="second" />
      </MetaMaskProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() => {
      expect(screen.getByText(`first: ${firstAccount}`)).toBeInTheDocument();
      expect(screen.getByText(`second: ${firstAccount}`)).toBeInTheDocument();
    });
    expect(ethereum.request).toHaveBeenCalledWith({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });

    act(() => ethereum.emit('accountsChanged', [secondAccount]));

    expect(screen.getByText(`first: ${secondAccount}`)).toBeInTheDocument();
    expect(screen.getByText(`second: ${secondAccount}`)).toBeInTheDocument();

    act(() => {
      ethereum.request.mockImplementation(async ({ method }) => {
        if (method === 'wallet_requestPermissions') return [{ parentCapability: 'eth_accounts' }];
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [firstAccount];
        if (method === 'eth_chainId') return '0x1';
        throw new Error(`Unexpected RPC method: ${method}`);
      });
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() => {
      expect(screen.getByText(`first: ${firstAccount}`)).toBeInTheDocument();
      expect(screen.getByText(`second: ${firstAccount}`)).toBeInTheDocument();
    });

    act(() => ethereum.emit('accountsChanged', []));

    expect(screen.getByText('first: disconnected')).toBeInTheDocument();
    expect(screen.getByText('second: disconnected')).toBeInTheDocument();
  });
});
