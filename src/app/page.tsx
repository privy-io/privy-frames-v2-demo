"use client";
import { useConnectWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import React, { useEffect, useState } from "react";
import { useLoginToMiniApp } from "@privy-io/react-auth/farcaster";
import miniappSdk from "@farcaster/miniapp-sdk";

import { Button } from "@/components/ui/button";
import UserInfo from "@/components/user-info";
import { FullScreenLoader } from "@/components/ui/fullscreen-loader";
import { useAccount, useSendTransaction } from "wagmi";
import { parseEther } from "viem";
const Home = () => {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { initLoginToMiniApp, loginToMiniApp } = useLoginToMiniApp();
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const { wallets } = useWallets();
  // an effect to ensure if we are in mini app context
  useEffect(() => {
    if (miniappSdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      miniappSdk.actions.ready();
    }
  }, [isSDKLoaded]);

  // here we handle the login user automatically with farcaster (removes the need for the user to click the login button, can be removed if you want to use the login button)
  // when you open in TBA, if the user has linked their farcaster account, they will be logged in automatically
  // change this useEffect to your needs
  useEffect(() => {
    if (ready && !authenticated) {
      const login = async () => {
        // Initialize a new login attempt to get a nonce for the Farcaster wallet to sign
        const { nonce } = await initLoginToMiniApp();
        // Request a signature from Farcaster
        const result = await miniappSdk.actions.signIn({ nonce: nonce });
        // Send the received signature from Farcaster to Privy for authentication
        // or pass a SIWF message signed by an auth address
        await loginToMiniApp({
          message: result.message,
          signature: result.signature,
        });
      };
      login();
    }
  }, [ready, authenticated]);
  if (!ready) {
    return <FullScreenLoader />;
  }
  return (
    <div className="flex flex-col gap-4 ">
      <h1 className="text-2xl font-bold text-center">
        Privy Farcaster Miniapp Demo
      </h1>
      {wallets[0] && (
        <div className="text-sm text-gray-500 text-center">
          Connected Wallet: {wallets[0].address.slice(0, 6)}...
          {wallets[0].address.slice(-4)}
        </div>
      )}

      <div>
        {authenticated ? (
          <div>
            <UserInfo /> <SendTransactionButton />
            <div className="flex flex-col gap-2">
              <Button onClick={() => logout()} variant="secondary">
                Logout
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full" onClick={() => login()}>
            Login
          </Button>
        )}
      </div>
    </div>
  );
};

export default Home;

const SendTransactionButton = () => {
  // const { sendTransaction } = useSendTransaction();
  const {
    data: hash,
    sendTransactionAsync,
    isPending,
    isIdle,
    isError,
    isSuccess,
    error,
  } = useSendTransaction();
  const { wallets } = useWallets();
  const { connectWallet } = useConnectWallet();
  const { address, isConnected } = useAccount();

  const handleSendTransaction = async () => {
    // await sendTransaction(
    //   {
    //     to: "0x0000000000000000000000000000000000000000",
    //     value: 1,
    //     chainId: 8453,
    //   },
    //   {
    //     address: wallets[0].address,
    //   }
    // );

    await sendTransactionAsync({
      to: "0x1A3cDE21e27CA9a2670C2c647550D39a72d9637C",
      value: parseEther("0.00000001"),
    });
  };

  return (
    <div>
      {wallets[0] ? (
        <div>
          <Button
            className="w-full my-2"
            onClick={handleSendTransaction}
            disabled={isPending || isSuccess || isError}
          >
            Send Transaction
          </Button>
          {hash && (
            <div className="flex items-center gap-2">
              <div className="text-sm text-gray-500">
                Transaction sent:{" "}
                <a
                  href={`https://basescan.org/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  view on basescan
                </a>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Button className="w-full my-2" onClick={() => connectWallet()}>
          Connect Wallet
        </Button>
      )}
    </div>
  );
};
