import { SupportedWallet, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { SnackbarProvider } from 'notistack'
import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './Home'
import { getAlgodConfigFromViteEnvironment, getKmdConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

export default function App() {
  const algodConfig = getAlgodConfigFromViteEnvironment()
  const isMainnet = (import.meta.env.VITE_ALGOD_NETWORK || 'mainnet').toLowerCase() === 'mainnet'
  // Algorand CAIP Chain IDs for Pera Wallet Connect: MainNet = 416001 (or 4160), TestNet = 416002
  const peraChainId: 416001 | 416002 = isMainnet ? 416001 : 416002
  console.log(`[PeraWallet Diagnostic] VITE_ALGOD_NETWORK: '${import.meta.env.VITE_ALGOD_NETWORK}', isMainnet: ${isMainnet}, passing Pera chainId: ${peraChainId}`)

  let supportedWallets: SupportedWallet[]
  if (import.meta.env.VITE_ALGOD_NETWORK === 'localnet') {
    const kmdConfig = getKmdConfigFromViteEnvironment()
    supportedWallets = [
      {
        id: WalletId.KMD,
        options: {
          baseServer: kmdConfig.server,
          token: String(kmdConfig.token),
          port: String(kmdConfig.port),
        },
      },
    ]
  } else {
    supportedWallets = [
      { id: WalletId.DEFLY },
      {
        id: WalletId.PERA,
        options: {
          compactMode: false,
          chainId: peraChainId,
        },
      },
      { id: WalletId.EXODUS },
      { id: WalletId.LUTE },
    ]
  }

  const walletManager = new WalletManager({
    wallets: supportedWallets,
    defaultNetwork: 'mainnet',
    networks: {
      mainnet: {
        algod: {
          baseServer: 'https://mainnet-api.algonode.cloud',
          port: '',
          token: '',
        },
      },
      testnet: {
        algod: {
          baseServer: 'https://testnet-api.algonode.cloud',
          port: '',
          token: '',
        },
      },
    },
    options: {
      resetNetwork: true,
    },
  })

  return (
    <SnackbarProvider maxSnack={3}>
      <WalletProvider manager={walletManager}>
        <Routes>
          {/* Landing page */}
          <Route path="/" element={<Home />} />
          {/* Auth pages */}
          <Route path="/login" element={<Home />} />
          <Route path="/signup" element={<Home />} />
          {/* Dashboard */}
          <Route path="/app" element={<Home />} />
          {/* Hidden demo route (disabled locally — was used during waitlist mode)
          <Route path="/demo" element={<Home />} />
          */}
          {/* Catch-all → landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WalletProvider>
    </SnackbarProvider>
  )
}
