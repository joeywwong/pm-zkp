import './App.css';
import React from 'react';
import { useMetaMask } from './hooks/useMetaMask';
import CallContract from './components/CallContract';
import TokenList from './components/TokenList';

function App() {
  const { account, connect } = useMetaMask();
  // If account is an object, get the address; otherwise use it directly
  
  const address_string = account && typeof account === 'object' ? account.address : account;

  return (
    <div className="App">
      <header className="App-header">
        {/*
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload. Joe added this to test! Joe also edited this to test bind mount and hot reload
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        */}
        {!account ? (
          <button onClick={connect}>Connect MetaMask</button>
        ) : (
          <p>Connected account: {address_string}</p>
        )}
          <TokenList />
          <CallContract />
      </header>
    </div>
  );
}

export default App;
