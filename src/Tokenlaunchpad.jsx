'use client'

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Keypair,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  Connection,
} from "@solana/web3.js";
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction
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

  const wallet = useWallet();

  const devnetConnection = new Connection(clusterApiUrl('devnet'));

  async function createToken(e) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setCreatedToken(null);

    if (!wallet.publicKey) {
      setError("Please connect your wallet first");
      setIsLoading(false);
      return;
    }

    try {
      // Generate the mint keypair
      const mintKeypair = Keypair.generate();

      // Get the minimum lamports required for the mint
      const mintRent = await devnetConnection.getMinimumBalanceForRentExemption(MINT_SIZE);

      // Create the account instruction
      const createAccountInstruction = SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID
      });

      // Create the initialization instruction
      const initializeMintInstruction = createInitializeMintInstruction(
        mintKeypair.publicKey,
        decimals,
        wallet.publicKey,
        enableFreezeAuthority ? wallet.publicKey : null,
        TOKEN_PROGRAM_ID
      );

      // Get the associated token account address
      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey,
        wallet.publicKey
      );

      // Create the associated token account instruction
      const createAtaInstruction = createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        associatedTokenAccount,
        wallet.publicKey,
        mintKeypair.publicKey
      );

      // Calculate the real supply with decimals
      const realSupply = tokenSupply * Math.pow(10, decimals);

      // Create the mint to instruction
      const mintToInstruction = createMintToInstruction(
        mintKeypair.publicKey,
        associatedTokenAccount,
        wallet.publicKey,
        realSupply,
        [],
        TOKEN_PROGRAM_ID
      );

      // Create and send the combined transaction
      const transaction = new Transaction().add(
        createAccountInstruction,
        initializeMintInstruction,
        createAtaInstruction,
        mintToInstruction
      );

      // Get the latest blockhash
      const { blockhash } = await devnetConnection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Send the transaction
      const signature = await wallet.sendTransaction(transaction, devnetConnection, {
        signers: [mintKeypair]
      });

      // Confirm transaction
      const confirmation = await devnetConnection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed to confirm');
      }

      // Set the created token details
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

    } catch (error) {
      console.error("Error creating token:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto"
      >
        <h1 className="text-4xl font-bold mb-8 text-center">Solana Token Launchpad</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white bg-opacity-10 p-6 rounded-lg"
          >
            <h2 className="text-3xl font-semibold mb-6">Create New Token</h2>
            <form className="space-y-4" onSubmit={createToken}>
              <div>
                <label className="block text-lg font-medium mb-4">Token Name</label>
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
                <label className="block text-lg font-medium mb-4">Token Symbol</label>
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
                <label className="block text-lg font-medium mb-4">Initial Supply</label>
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
                <label className="block text-lg font-medium mb-4">Decimals</label>
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
                <label htmlFor="freezeAuthority" className="text-lg font-medium">
                  Enable Freeze Authority
                </label>
              </div>

              <motion.button
                type="submit"
                disabled={isLoading || !wallet.publicKey}
                className={`w-full py-3 text-xl rounded-md font-bold transition-colors ${isLoading || !wallet.publicKey
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
                className="bg-white bg-opacity-10 p-6 rounded-lg"
              >
                <h2 className="text-2xl font-semibold mb-6">Token Created Successfully!</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
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
                    <div className="col-span-2">
                      <p className="text-gray-400 text-sm">Token Address</p>
                      <p className="font-medium break-all">{createdToken.address}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-400 text-sm">Transaction Signature</p>
                      <p className="font-medium break-all">{createdToken.signature}</p>
                    </div>
                    <div className="col-span-2">
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
          </motion.div>
        </div>
      </motion.div>
      <Footer/>
    </div>
  );
}