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
import { useWallet } from '@solana/wallet-adapter-react';
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
    e.preventDefault(); // Prevent the default form submission behavior.
    setIsLoading(true); // Set loading state to true, usually to show a spinner.
    setError(''); // Clear any previous error messages.
    setCreatedToken(null); // Reset the created token details.

    // Check if the wallet is connected
    if (!wallet.publicKey) {
      setError("Please connect your wallet first"); // Show an error if wallet is not connected.
      setIsLoading(false); // Stop loading if no wallet is connected.
      return; // Exit the function early.
    }

    try {
      // Generate the mint keypair (the unique identifier for the new token).
      const mintKeypair = Keypair.generate();

      // Calculate the minimum balance needed to make the token account rent-exempt.
      const mintRent = await devnetConnection.getMinimumBalanceForRentExemption(MINT_SIZE);

      // Create an instruction to create the new account for the token.
      const createAccountInstruction = SystemProgram.createAccount({
        fromPubkey: wallet.publicKey, // Funding the new account from the user's wallet.
        newAccountPubkey: mintKeypair.publicKey, // New token account public key.
        space: MINT_SIZE, // Required space for the token mint account.
        lamports: mintRent, // Amount of lamports to fund the account for rent exemption.
        programId: TOKEN_PROGRAM_ID // Specifies that this account is for tokens.
      });

      // Instruction to initialize the mint (set initial parameters for the token).
      const initializeMintInstruction = createInitializeMintInstruction(
        mintKeypair.publicKey, // The mint (token) account.
        decimals, // Number of decimal places for the token.
        wallet.publicKey, // Token owner.
        enableFreezeAuthority ? wallet.publicKey : null, // Freeze authority if applicable.
        TOKEN_PROGRAM_ID // Specifies token program for the mint.
      );

      // Get the address for the associated token account.
      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintKeypair.publicKey, // Mint account for the token.
        wallet.publicKey // The wallet address to hold the tokens.
      );

      // Instruction to create the associated token account for the wallet.
      const createAtaInstruction = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // Payer to fund the associated token account creation.
        associatedTokenAccount, // Associated token account address.
        wallet.publicKey, // Owner of the associated token account.
        mintKeypair.publicKey // Mint for which the token account is created.
      );

      // Calculate the total supply in terms of smallest units (e.g., "cents" if it’s USD).
      const realSupply = tokenSupply * Math.pow(10, decimals);

      // Instruction to mint the specified amount of tokens to the associated token account.
      const mintToInstruction = createMintToInstruction(
        mintKeypair.publicKey, // Mint account.
        associatedTokenAccount, // Destination associated token account.
        wallet.publicKey, // Authority to mint tokens.
        realSupply, // Number of tokens to mint in smallest units.
        [], // Signer for the minting (none needed here).
        TOKEN_PROGRAM_ID // Specifies the token program.
      );

      // Create a transaction and add all instructions to it.
      const transaction = new Transaction().add(
        createAccountInstruction,
        initializeMintInstruction,
        createAtaInstruction,
        mintToInstruction
      );

      // Fetch the latest blockhash to ensure transaction recency.
      const { blockhash } = await devnetConnection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash; // Set the blockhash.
      transaction.feePayer = wallet.publicKey; // Set the payer for the transaction fees.

      // Send the transaction and sign it with the mint keypair.
      const signature = await wallet.sendTransaction(transaction, devnetConnection, {
        signers: [mintKeypair] // Include the mint keypair as a signer.
      });

      // Confirm that the transaction succeeded.
      const confirmation = await devnetConnection.confirmTransaction(signature, 'confirmed');

      // If there was an error during confirmation, throw an error.
      if (confirmation.value.err) {
        throw new Error('Transaction failed to confirm');
      }

      // Set the created token details for display or tracking.
      setCreatedToken({
        address: mintKeypair.publicKey.toString(), // Token address.
        name: tokenName, // Token name.
        symbol: tokenSymbol, // Token symbol.
        supply: tokenSupply, // Initial supply.
        decimals: decimals, // Number of decimals.
        freezeAuthority: enableFreezeAuthority, // Indicates if freeze authority is enabled.
        explorerUrl: `https://explorer.solana.com/address/${mintKeypair.publicKey.toString()}?cluster=devnet`, // URL for blockchain explorer.
        signature: signature // Transaction signature.
      });

      console.log('Token created successfully!', signature); // Log success message.

    } catch (error) {
      console.error("Error creating token:", error); // Log the error to the console.
      setError(error.message); // Display the error to the user.
    } finally {
      setIsLoading(false); // End the loading state.
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
        <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-center">Solana Token Launchpad</h1>

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
          </motion.div>
        </div>
      </motion.div>
      <Footer />
    </div>

  );
}