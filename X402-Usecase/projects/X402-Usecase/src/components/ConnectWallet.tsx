import { useWallet, Wallet, WalletId } from '@txnlab/use-wallet-react'
import Account from './Account'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  const { wallets, activeAddress } = useWallet()

  const isKmd = (wallet: Wallet) => wallet.id === WalletId.KMD

  return (
    <dialog id="connect_wallet_modal" className={`modal backdrop-blur-md ${openModal ? 'modal-open' : ''}`}>
      <form method="dialog" className="modal-box liquid-glass text-white p-8">
        <h3 className="font-extrabold text-2xl text-white">Select Wallet Provider</h3>

        <div className="grid m-2 pt-5">
          {activeAddress && (
            <>
              <Account />
              <div className="divider border-slate-800" />
            </>
          )}

          {!activeAddress &&
            wallets?.map((wallet) => (
              <button
                data-test-id={`${wallet.id}-connect`}
                className="btn m-2 flex items-center justify-center gap-4 text-white"
                key={`provider-${wallet.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  wallet.connect()
                }}
              >
                {!isKmd(wallet) && (
                  <img
                    alt={`wallet_icon_${wallet.id}`}
                    src={wallet.metadata.icon}
                    style={{ objectFit: 'contain', width: '24px', height: '24px' }}
                  />
                )}
                <span className="font-semibold text-white">{isKmd(wallet) ? 'LocalNet Wallet' : wallet.metadata.name}</span>
              </button>
            ))}
        </div>

        <div className="modal-action mt-6">
          <button
            data-test-id="close-wallet-modal"
            className="btn px-6 text-white font-medium"
            onClick={(e) => {
              e.preventDefault()
              closeModal()
            }}
          >
            Close
          </button>
          {activeAddress && (
            <button
              className="btn btn-warning px-6 font-semibold"
              data-test-id="logout"
              onClick={async (e) => {
                e.preventDefault()
                if (wallets) {
                  const activeWallet = wallets.find((w) => w.isActive)
                  if (activeWallet) {
                    await activeWallet.disconnect()
                  } else {
                    localStorage.removeItem('@txnlab/use-wallet:v3')
                    window.location.reload()
                  }
                }
              }}
            >
              Logout
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
export default ConnectWallet
