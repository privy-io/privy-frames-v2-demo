"use client";

import { useEffect, useCallback, useState } from "react";
import frameSdk, { type FrameContext } from "@farcaster/frame-sdk";

import { Button } from "~/components/ui/Button";
import { FullScreenLoader } from "~/components/ui/FullScreenLoader";
import { usePrivy } from "@privy-io/react-auth";
import { useLoginToFrame } from "@privy-io/react-auth/farcaster";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { YOINK_ABI } from "~/lib/yoinkAbi";

import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import JSConfetti from "js-confetti";

type Yoinkalytics = {
  yoinks: number;
  lastYoinkedAt: string;
  lastYoinkedBy: string;
  totalYoinks: number;
};

export default function PrivyV2FramesDemo() {
  const { ready, authenticated, user } = usePrivy();
  const { client } = useSmartWallets();
  const { initLoginToFrame, loginToFrame } = useLoginToFrame();
  const confetti = new JSConfetti();

  // UI state
  const [context, setContext] = useState<FrameContext>();
  const [isFrameContextOpen, setIsFrameContextOpen] = useState(false);
  const [isPrivyUserObjectOpen, setIsPrivyUserObjectOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Yoink state
  const [yoinkalytics, setYoinkalytics] = useState<Yoinkalytics | null>(null);

  // Loading states
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [isCallingYoink, setIsCallingYoink] = useState(false);

  // Derived state
  const smartWallet = user?.linkedAccounts.find(
    (account) => account.type === "smart_wallet",
  );

  // Contract configuration
  const YOINK_CONTRACT_ADDRESS = "0x4bBFD120d9f352A0BEd7a014bd67913a2007a878";
  const yoinkContract = {
    address: YOINK_CONTRACT_ADDRESS,
    abi: YOINK_ABI,
  } as const;

  /**
   * Calls the yoink function on the yoink contract.
   */
  const yoinkFlag = async () => {
    if (!client) return;

    if (!smartWallet) {
      setErrorMessage(
        "Smart wallet has not yet been created. Unable to yoink.",
      );
      return;
    }

    try {
      setIsCallingYoink(true);

      // Switch chain to Base
      await client.switchChain({ id: 8453 });

      // Call yoink function
      await client.writeContract({
        address: yoinkContract.address,
        abi: yoinkContract.abi,
        functionName: "yoink",
        args: [],
      });

      // Refresh analytics
      await refreshYoinkalytics(smartWallet.address);

      // Celebrate
      confetti.addConfetti({
        emojis: ["🚩"],
      });
    } catch (error) {
      if (!(error instanceof Error)) return;
      // Error codes are not recognized by ZeroDev, so we explicitly check the error message
      if (error.message.includes("0x58d6f4c6")) {
        setErrorMessage("Slow down! You must wait 10 minutes between yoinks.");
      } else if (error.message.includes("0x82b42900")) {
        setErrorMessage("Woops! You can't yoink yourself.");
      } else {
        setErrorMessage(
          "Sorry! An unknown error occurred. Please try again later.",
        );
      }
    } finally {
      setIsCallingYoink(false);
    }
  };

  /**
   * Fetches yoinkalytics for a given wallet address that includes basic information
   * on number of yoinks, last yoinked at time, last yoinker, and total yoinks.
   *
   * @param address The address of the wallet to fetch yoinkalytics for
   */
  async function refreshYoinkalytics(address: string) {
    // Create public client for Base
    const client = createPublicClient({
      chain: base,
      transport: http("https://mainnet.base.org"),
    });

    try {
      // Pull number of yoinks and last yoinked at time
      const score = (await client.readContract({
        ...yoinkContract,
        functionName: "score",
        args: [address],
      })) as { yoinks: bigint; lastYoinkedAt: string };

      // Pull last yoinked by (global)
      const lastYoinkedBy = (await client.readContract({
        ...yoinkContract,
        functionName: "lastYoinkedBy",
      })) as string;

      // Pull total yoinks (global)
      const totalYoinks = (await client.readContract({
        ...yoinkContract,
        functionName: "totalYoinks",
      })) as bigint;

      // Set latest yoinkalytics
      setYoinkalytics({
        yoinks: Number(score.yoinks),
        lastYoinkedAt: new Date(
          Number(score.lastYoinkedAt) * 1000,
        ).toLocaleString(),
        lastYoinkedBy: lastYoinkedBy,
        totalYoinks: Number(totalYoinks),
      });
    } catch (error) {
      console.error("There was an error fetching yoinkalytics: ", error);
      setYoinkalytics({
        yoinks: -1,
        lastYoinkedAt: "",
        lastYoinker: "",
        totalYoinks: -1,
      });
    }
  }

  useEffect(() => {
    if (!smartWallet) return;
    refreshYoinkalytics(smartWallet.address);
  }, [smartWallet?.address]);

  // Initialize the frame SDK
  useEffect(() => {
    const load = async () => {
      setContext(await frameSdk.context);
      frameSdk.actions.ready({});
    };
    if (frameSdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
    }
  }, [isSDKLoaded]);

  const closeFrame = useCallback(() => {
    frameSdk.actions.close();
  }, []);

  const toggleFrameContext = useCallback(() => {
    setIsFrameContextOpen((prev) => !prev);
  }, []);

  const togglePrivyUserObject = useCallback(() => {
    setIsPrivyUserObjectOpen((prev) => !prev);
  }, []);

  // Login to Frame with Privy automatically
  useEffect(() => {
    if (ready && !authenticated) {
      const login = async () => {
        const { nonce } = await initLoginToFrame();
        const result = await frameSdk.actions.signIn({ nonce: nonce.nonce });
        await loginToFrame({
          message: result.message,
          signature: result.signature,
        });
      };
      login();
    }
  }, [ready, authenticated, initLoginToFrame, loginToFrame]);

  if (!ready || !isSDKLoaded || !authenticated || !yoinkalytics) {
    return <FullScreenLoader />;
  }

  return (
    <div className="w-[360px] mx-auto py-4 px-2">
      <h1 className="text-2xl font-bold text-center mb-4">
        🚩 Embedded Yoinking 🚩
        <br />
        by Privy
      </h1>
      <div className="mb-4">
        <h2 className="font-2xl font-bold">Frame Context</h2>
        <button
          onClick={toggleFrameContext}
          className="flex items-center gap-2 transition-colors"
        >
          <span
            className={`transform transition-transform ${
              isFrameContextOpen ? "rotate-90" : ""
            }`}
          >
            ➤
          </span>
          Tap to expand
        </button>

        {isFrameContextOpen && (
          <div className="p-4 mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <pre className="font-mono text-xs whitespace-pre-wrap break-words max-w-[260px] overflow-x-">
              {JSON.stringify(context, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="mb-4">
        <h2 className="font-2xl font-bold">Privy User</h2>
        <button
          onClick={togglePrivyUserObject}
          className="flex items-center gap-2 transition-colors"
        >
          <span
            className={`transform transition-transform ${
              isPrivyUserObjectOpen ? "rotate-90" : ""
            }`}
          >
            ➤
          </span>
          Tap to expand
        </button>

        {isPrivyUserObjectOpen && (
          <div className="p-4 mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <pre className="font-mono text-xs whitespace-pre-wrap break-words max-w-[260px] overflow-x-">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-2xl font-bold">My Yoinkalytics</h2>

        <div className="p-4 mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg mb-2">
          <pre className="font-mono text-xs whitespace-pre-wrap break-words max-w-[260px] overflow-x-">
            {JSON.stringify(yoinkalytics, null, 2)}
          </pre>
        </div>
      </div>

      <div>
        <div className="mb-4">
          <Button
            onClick={yoinkFlag}
            isLoading={isCallingYoink}
            disabled={isCallingYoink}
          >
            Yoink!
          </Button>
          {errorMessage && (
            <div className="text-red-500 text-center text-xs mt-2">
              {errorMessage}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-4">
          {smartWallet && (
            <Button
              onClick={() =>
                frameSdk.actions.openUrl(
                  `https://basescan.org/address/${encodeURIComponent(smartWallet.address)}#nfttransfers`,
                )
              }
            >
              View on Basescan
            </Button>
          )}
        </div>
      </div>

      <div>
        <div className="mb-4">
          <Button onClick={closeFrame}>Close</Button>
        </div>
      </div>
    </div>
  );
}