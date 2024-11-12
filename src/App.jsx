import './App.css'
import Tokenlaunchpad from './Tokenlaunchpad'
// wallet adapter imports
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import {
  WalletModalProvider,
  WalletDisconnectButton,
  WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import './index.css'
function App() {

  return (
    <>
      <ConnectionProvider endpoint={"https://api.devnet.solana.com"}>
        <WalletProvider wallets={[]} autoConnect>
          <WalletModalProvider>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: 20,
              backgroundColor: 'black'
            }}>
              <WalletMultiButton style={{backgroundColor:'rgb(31 41 55)',color:"white"}} />
              <WalletDisconnectButton style={{backgroundColor:'rgb(31 41 55)',color:"white"}} />
            </div>
            <Tokenlaunchpad/>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </>
  )
}

export default App
