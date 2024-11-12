'use client'

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Keypair,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  Connection,
  PublicKey,
} from "@solana/web3.js";
import { useWallet } from '@solana/wallet-adapter-react';
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction,
  createTransferInstruction,
  AccountLayout,
  getOrCreateAssociatedTokenAccount,
  createMint,
  mintTo,
} from "@solana/spl-token";
import Footer from './Footer';

export default function TokenLaunchpad() {
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenSupply, setTokenSupply] = useState(0);
  const [decimals, setDecimals] = useState(9);
  const [enableFreezeAuthority, setEnableFreezeAuthority] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createdToken, setCreatedToken] = useState(null);
  const [error, setError] = useState('');
  const [userTokens, setUserTokens] = useState([]);
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [selectedToken, setSelectedToken] = useState('');

  const wallet = useWallet();
  const devnetConnection = new Connection(clusterApiUrl('devnet'));

  useEffect(() => {
    if (wallet.publicKey) {
      fetchUserTokens();
    }
  }, [wallet.publicKey]);

  async function fetchUserTokens() {
    const tokenAccounts = await devnetConnection.getTokenAccountsByOwner(
      wallet.publicKey,
      {
        programId: TOKEN_PROGRAM_ID,
      }
    );
    const tokens = tokenAccounts.value.map((tokenAccount) => {
      const accountData = AccountLayout.decode(tokenAccount.account.data);
      const publicKey = new PublicKey(accountData.mint).toBase58();
      const amount = parseInt(accountData.amount, 10);

      return { publicKey, amount };
    });

    setUserTokens(tokens);
  }
  console.log(userTokens)

  async function createToken(e) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setCreatedToken(null);
    if (!wallet || !wallet.publicKey || !wallet.signTransaction) {
      setError('Please connect your wallet and approve the transaction.');
      setIsLoading(false);
      return;
    }

    try {
      const mintKeypair = Keypair.generate();
      const mintRent = await devnetConnection.getMinimumBalanceForRentExemption(MINT_SIZE);

      const createAccountInstruction = SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID
      });

      const initializeMintInstruction = createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        wallet.publicKey,
        enableFreezeAuthority ? wallet.publicKey : null,
        TOKEN_PROGRAM_ID
      );

      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        wallet.publicKey
      );

      const createAtaInstruction = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        associatedTokenAccount,
        wallet.publicKey,
        mintKeypair.publicKey
      );

      const realSupply = tokenSupply * Math.pow(10, decimals);

      const mintToInstruction = createMintToInstruction(
        mintKeypair.publicKey,
        associatedTokenAccount,
        wallet.publicKey,
        realSupply,
        [],
        TOKEN_PROGRAM_ID
      );

      const transaction = new Transaction().add(
        createAccountInstruction,
        initializeMintInstruction,
        createAtaInstruction,
        mintToInstruction
      );

      const { blockhash } = await devnetConnection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signature = await wallet.sendTransaction(transaction, devnetConnection, {
        signers: [mintKeypair]
      });

      const confirmation = await devnetConnection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed to confirm');
      }

      setCreatedToken({
        address: mintKeypair.publicKey.toString(),
        name: tokenName,
        symbol: tokenSymbol,
        supply: tokenSupply,
        decimals: decimals,
        freezeAuthority: enableFreezeAuthority,
        explorerUrl: `https://explorer.solana.com/address/${mintKeypair.publicKey.toString()}?cluster=devnet`,
        signature: signature
      });

      console.log('Token created successfully!', signature);
      fetchUserTokens();

    } catch (error) {
      console.error("Error creating token:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }
  async function transferToken(e) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!wallet.publicKey) {
      setError("Please connect your wallet first");
      setIsLoading(false);
      return;
    }

    try {
      // Validate recipient address
      let recipientPubKey;
      try {
        recipientPubKey = new PublicKey(recipientAddress);
      } catch (err) {
        throw new Error('Invalid recipient address');
      }

      // Validate selected token and amount
      if (!selectedToken) {
        throw new Error('Please select a token to transfer');
      }
      if (!transferAmount || transferAmount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const mintPublicKey = new PublicKey(selectedToken);

      // Get the sender's ATA (Associated Token Account)
      const senderATA = await getAssociatedTokenAddress(
        mintPublicKey,
        wallet.publicKey
      );

      // Get or create the recipient's ATA
      const recipientATA = await getAssociatedTokenAddress(
        mintPublicKey,
        recipientPubKey
      );

      // Check if recipient ATA exists, if not create it
      const recipientAccount = await devnetConnection.getAccountInfo(recipientATA);

      const transaction = new Transaction();

      if (!recipientAccount) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            recipientATA,
            recipientPubKey,
            mintPublicKey
          )
        );
      }

      // Calculate the amount with decimals
      const adjustedAmount = transferAmount * Math.pow(10, decimals);

      // Add transfer instruction
      transaction.add(
        createTransferInstruction(
          senderATA,
          recipientATA,
          wallet.publicKey,
          BigInt(adjustedAmount)
        )
      );

      // Get latest blockhash
      const { blockhash } = await devnetConnection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Send transaction
      const signature = await wallet.sendTransaction(transaction, devnetConnection);

      // Confirm transaction
      const confirmation = await devnetConnection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed to confirm');
      }

      // Clear form and refresh token balances
      setTransferAmount('');
      setRecipientAddress('');
      setSelectedToken('');
      await fetchUserTokens();

      // Show success message
      console.log('Transfer successful:', signature);

    } catch (error) {
      console.error("Error transferring token:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }



  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto"
      >
        <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-center">Token Launchpad</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 w-full">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white bg-opacity-10 p-4 sm:p-6 rounded-lg"
          >
            <h2 className="text-2xl sm:text-3xl font-semibold mb-6">Create New Token</h2>
            <form className="space-y-4" onSubmit={createToken}>
              <div>
                <label className="block text-base sm:text-lg font-medium mb-4">Token Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-black border border-white rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="e.g., MyToken"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-base sm:text-lg font-medium mb-4">Token Symbol</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-black border border-white rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="e.g., MTK"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-base sm:text-lg font-medium mb-4">Initial Supply</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 bg-black border border-white rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="e.g., 1000000"
                  value={tokenSupply}
                  onChange={(e) => setTokenSupply(Number(e.target.value))}
                  required
                />
              </div>

              <div>
                <label className="block text-base sm:text-lg font-medium mb-4">Decimals</label>
                <input
                  type="number"
                  className="w-full px-4 py-2 bg-black border border-white rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
                  min="0"
                  max="9"
                  value={decimals}
                  onChange={(e) => setDecimals(Number(e.target.value))}
                  required
                />
              </div>

              <div className="flex items-center space-x-2 py-3">
                <input
                  type="checkbox"
                  id="freezeAuthority"
                  checked={enableFreezeAuthority}
                  onChange={(e) => setEnableFreezeAuthority(e.target.checked)}
                  className="w-5 h-5 rounded border-white bg-black text-white focus:ring-white"
                />
                <label htmlFor="freezeAuthority" className="text-base sm:text-lg font-medium">
                  Enable Freeze Authority
                </label>
              </div>

              <motion.button
                type="submit"
                disabled={isLoading || !wallet.publicKey}
                className={`w-full py-3 text-lg sm:text-xl rounded-md font-bold transition-colors ${isLoading || !wallet.publicKey
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-gray-200'
                  }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isLoading ? 'Creating Token...' : 'Launch Token'}
              </motion.button>
            </form>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="space-y-4"
          >
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500 bg-opacity-20 border border-red-500 text-red-100 px-4 py-3 rounded-lg"
              >
                <p className="font-semibold">Error</p>
                <p className="text-sm">{error}</p>
              </motion.div>
            )}

            {createdToken && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white bg-opacity-10 p-4 sm:p-6 rounded-lg"
              >
                <h2 className="text-xl sm:text-2xl font-semibold mb-6">Token Created Successfully!</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Name</p>
                      <p className="font-medium">{createdToken.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Symbol</p>
                      <p className="font-medium">{createdToken.symbol}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Supply</p>
                      <p className="font-medium">{createdToken.supply}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Decimals</p>
                      <p className="font-medium">{createdToken.decimals}</p>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <p className="text-gray-400 text-sm">Token Address</p>
                      <p className="font-medium break-all">{createdToken.address}</p>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <p className="text-gray-400 text-sm">Transaction Signature</p>
                      <p className="font-medium break-all">{createdToken.signature}</p>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <p className="text-gray-400 text-sm">Features</p>
                      <p className="font-medium">
                        {createdToken.freezeAuthority ? '✓ Freeze Authority Enabled' : '✗ No Freeze Authority'}
                      </p>
                    </div>
                  </div>

                  <motion.a
                    href={createdToken.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-4 font-bold text-center py-2 bg-white text-black hover:bg-gray-200 rounded-md transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    View on Solana Explorer
                  </motion.a>
                </div>
              </motion.div>
            )}

            {!wallet.publicKey && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-yellow-500 bg-opacity-20 border border-yellow-500 text-yellow-100 px-4 py-3 rounded-lg"
              >
                <p className="font-semibold">Wallet Not Connected</p>
                <p className="text-sm">Please connect your wallet to create tokens</p>
              </motion.div>
            )}

            {wallet.publicKey && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white bg-opacity-10 p-4 sm:p-6 rounded-lg"
              >
                <h2 className="text-xl sm:text-2xl font-semibold mb-6">Your Token Balances</h2>
                {userTokens.length > 0 ? (
                  <ul className="space-y-2">
                    {userTokens.map((token, index) => (
                      <li key={index} className="flex justify-between items-center">
                        <span>{token.publicKey.slice(0,15)}......</span>
                        <span className="font-bold">Balance: {token.amount}....</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No tokens found in your wallet.</p>
                )}
              </motion.div>
            )}

            {wallet.publicKey && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white bg-opacity-10 p-4 sm:p-6 rounded-lg"
              >
                <h2 className="text-xl sm:text-2xl font-semibold mb-6">Transfer Tokens</h2>
                <form className="space-y-4" onSubmit={transferToken}>
                  <div>
                    <label className="block text-base sm:text-lg font-medium mb-2">Select Token</label>
                    <select
                      className="w-full px-4 py-2 bg-black border border-white rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
                      value={selectedToken}
                      onChange={(e) => setSelectedToken(e.target.value)}
                      required
                    >
                      <option value="">Select a token</option>
                      {userTokens.map((token, index) => (
                        <option key={index} value={token.publicKey}>
                          {token.publicKey}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-base sm:text-lg font-medium mb-2">Amount</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2 bg-black border border-white rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
                      placeholder="Enter amount to transfer"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-base sm:text-lg font-medium mb-2">Recipient Address</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 bg-black border border-white rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white"
                      placeholder="Enter recipient's address"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      required
                    />
                  </div>
                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3 text-lg sm:text-xl rounded-md font-bold transition-colors ${isLoading ? "bg-gray-600 cursor-not-allowed" : "bg-white text-black hover:bg-gray-200"
                      }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Transfer Tokens
                  </motion.button>
                </form>
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.div>
      <Footer />
    </div>
  );
}