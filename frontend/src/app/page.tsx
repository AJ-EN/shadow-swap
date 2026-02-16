"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useCallback } from "react";

// Contract addresses (deployed on Sepolia)
const DARKPOOL_ADDRESS = process.env.NEXT_PUBLIC_DARKPOOL_ADDRESS || "0x0";
const VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_VERIFIER_ADDRESS || "0x0";

// Types
interface Order {
  id: string;
  type: "buy" | "sell";
  amount: number;
  price: number;
  status: "active" | "matched" | "completed" | "cancelled";
  secretHash?: string;
  createdAt: Date;
}

interface SwapStep {
  id: number;
  title: string;
  description: string;
  status: "pending" | "active" | "complete";
  actor: "alice" | "bob" | "contract";
}

// Icons
const BitcoinIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H11.5v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.64c.1 1.7 1.36 2.66 2.86 2.97V19h1.73v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.65-3.42z" />
  </svg>
);

const USDCIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="#2775CA" />
    <path d="M12 6v1.5m0 9V18m2.5-6.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" stroke="white" strokeWidth="1.5" fill="none" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

export default function Home() {
  const [btcAmount, setBtcAmount] = useState("1.0");
  const [usdcAmount, setUsdcAmount] = useState("50000");
  const [activeTab, setActiveTab] = useState<"swap" | "orders" | "demo">("swap");
  const [isSwapping, setIsSwapping] = useState(false);
  const [demoStep, setDemoStep] = useState(0);

  // Wallet hooks
  const { address, isConnected, status: accountStatus } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = useCallback(() => {
    // Connect with the first available connector
    if (connectors.length > 0) {
      connect({ connector: connectors[0] });
    }
  }, [connectors, connect]);

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  // Sample orders
  const orders: Order[] = [
    { id: "1", type: "sell", amount: 1.5, price: 48500, status: "active", createdAt: new Date() },
    { id: "2", type: "buy", amount: 0.5, price: 49200, status: "active", createdAt: new Date() },
    { id: "3", type: "sell", amount: 2.0, price: 48000, status: "matched", createdAt: new Date() },
  ];

  // Demo flow steps
  const swapSteps: SwapStep[] = [
    { id: 1, title: "Generate Secret", description: "Alice creates secret S and hash H", status: demoStep >= 1 ? "complete" : demoStep === 0 ? "active" : "pending", actor: "alice" },
    { id: 2, title: "Lock Bitcoin", description: "Alice locks BTC in HTLC with H", status: demoStep >= 2 ? "complete" : demoStep === 1 ? "active" : "pending", actor: "alice" },
    { id: 3, title: "Create Order", description: "USDC order submitted to Starknet", status: demoStep >= 3 ? "complete" : demoStep === 2 ? "active" : "pending", actor: "contract" },
    { id: 4, title: "Match Order", description: "Bob matches and deposits USDC", status: demoStep >= 4 ? "complete" : demoStep === 3 ? "active" : "pending", actor: "bob" },
    { id: 5, title: "Claim USDC", description: "Alice reveals S, claims USDC", status: demoStep >= 5 ? "complete" : demoStep === 4 ? "active" : "pending", actor: "alice" },
    { id: 6, title: "Claim Bitcoin", description: "Bob uses S to claim BTC", status: demoStep >= 6 ? "complete" : demoStep === 5 ? "active" : "pending", actor: "bob" },
  ];

  const handleSwap = async () => {
    setIsSwapping(true);
    // Simulate swap
    for (let i = 0; i <= 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setDemoStep(i);
    }
    setIsSwapping(false);
  };

  const handleReset = () => {
    setDemoStep(0);
    setIsSwapping(false);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-card border-t-0 rounded-t-none">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-glow">
              <LockIcon />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                ShadowSwap
              </h1>
              <p className="text-xs text-gray-500">Privacy-Preserving Dark Pool</p>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            {["swap", "orders", "demo"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${activeTab === tab
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="status-dot status-active" />
              <span className="text-xs text-emerald-400">Sepolia</span>
            </div>
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm text-indigo-300 font-mono">{truncatedAddress}</span>
                </div>
                <button
                  onClick={() => disconnect()}
                  className="btn-secondary text-sm text-red-400 hover:text-red-300"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="btn-secondary text-sm"
              >
                {accountStatus === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">

          {/* Hero Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
            {[
              { label: "24h Volume", value: "$12.4M", change: "+8.2%" },
              { label: "Total Orders", value: "1,847", change: "+124" },
              { label: "Avg. Spread", value: "0.12%", change: "-0.03%" },
              { label: "Active Pairs", value: "BTC/USDC", change: "" },
            ].map((stat, i) => (
              <div key={i} className={`glass-card p-5 stagger-${i + 1} animate-fade-in`} style={{ opacity: 0 }}>
                <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{stat.value}</span>
                  {stat.change && (
                    <span className={`text-sm ${stat.change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stat.change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {activeTab === "swap" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Swap Card */}
              <div className="lg:col-span-2 glass-card p-6 animate-fade-in">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <ArrowRightIcon />
                  </span>
                  Create Swap
                </h2>

                {/* From */}
                <div className="mb-4">
                  <label className="text-sm text-gray-400 mb-2 block">You Send</label>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)]">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400">
                      <BitcoinIcon />
                      <span className="font-medium">BTC</span>
                    </div>
                    <input
                      type="text"
                      value={btcAmount}
                      onChange={(e) => setBtcAmount(e.target.value)}
                      className="flex-1 bg-transparent text-2xl font-bold text-right outline-none crypto-amount"
                      placeholder="0.0"
                    />
                  </div>
                </div>

                {/* Swap Arrow */}
                <div className="flex justify-center -my-2 relative z-10">
                  <button className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--glass-border)] flex items-center justify-center hover:bg-[var(--surface-3)] transition-colors rotate-90">
                    <ArrowRightIcon />
                  </button>
                </div>

                {/* To */}
                <div className="mb-6">
                  <label className="text-sm text-gray-400 mb-2 block">You Receive</label>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--glass-border)]">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400">
                      <USDCIcon />
                      <span className="font-medium">USDC</span>
                    </div>
                    <input
                      type="text"
                      value={usdcAmount}
                      onChange={(e) => setUsdcAmount(e.target.value)}
                      className="flex-1 bg-transparent text-2xl font-bold text-right outline-none crypto-amount"
                      placeholder="0.0"
                    />
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 rounded-xl bg-[var(--surface-1)] mb-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Rate</span>
                    <span className="crypto-amount">1 BTC = 50,000 USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Network Fee</span>
                    <span className="text-gray-400">~0.0001 BTC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Timeout</span>
                    <span className="text-gray-400">~6 hours</span>
                  </div>
                </div>

                <button
                  onClick={handleSwap}
                  disabled={isSwapping}
                  className="btn-primary w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSwapping ? "Processing Atomic Swap..." : "Create Order"}
                </button>
              </div>

              {/* Swap Flow Visualization */}
              <div className="glass-card p-6 animate-fade-in stagger-2" style={{ opacity: 0 }}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <LockIcon />
                  Atomic Swap Flow
                </h3>

                <div className="space-y-6">
                  {swapSteps.map((step) => (
                    <div
                      key={step.id}
                      className={`flow-step ${step.status === "complete" ? "flow-step-complete" : ""}`}
                    >
                      <div className={`flow-step-icon ${step.status === "complete" ? "bg-indigo-500 border-indigo-500" :
                        step.status === "active" ? "border-indigo-500 animate-pulse" : ""
                        }`}>
                        {step.status === "complete" && <CheckIcon />}
                        {step.status === "active" && <span className="w-2 h-2 rounded-full bg-indigo-500" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${step.status === "complete" ? "text-indigo-400" :
                            step.status === "active" ? "text-white" : "text-gray-500"
                            }`}>
                            {step.title}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${step.actor === "alice" ? "bg-pink-500/20 text-pink-400" :
                            step.actor === "bob" ? "bg-blue-500/20 text-blue-400" :
                              "bg-purple-500/20 text-purple-400"
                            }`}>
                            {step.actor === "alice" ? "👩 Alice" : step.actor === "bob" ? "👨 Bob" : "📜 Contract"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {demoStep === 6 && (
                  <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <p className="text-emerald-400 font-medium">🎉 Swap Complete!</p>
                    <p className="text-sm text-gray-400 mt-1">Trustless cross-chain swap successful</p>
                    <button onClick={handleReset} className="mt-3 text-sm text-indigo-400 hover:underline">
                      Reset Demo
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <div className="glass-card p-6 animate-fade-in">
              <h2 className="text-xl font-semibold mb-6">Order Book</h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b border-[var(--glass-border)]">
                      <th className="pb-4">Type</th>
                      <th className="pb-4">Amount (BTC)</th>
                      <th className="pb-4">Price (USDC)</th>
                      <th className="pb-4">Total</th>
                      <th className="pb-4">Status</th>
                      <th className="pb-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, i) => (
                      <tr key={order.id} className="border-b border-[var(--glass-border)] hover:bg-white/5">
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${order.type === "sell" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                            }`}>
                            {order.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 crypto-amount">{order.amount.toFixed(4)}</td>
                        <td className="py-4 crypto-amount">${order.price.toLocaleString()}</td>
                        <td className="py-4 crypto-amount">${(order.amount * order.price).toLocaleString()}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <div className={`status-dot ${order.status === "active" ? "status-active" :
                              order.status === "matched" ? "status-pending" : "status-inactive"
                              }`} />
                            <span className="text-sm capitalize">{order.status}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <button className="btn-secondary text-sm py-2">
                            {order.status === "active" ? "Match" : "View"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "demo" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Alice Side */}
              <div className="glass-card p-6 animate-fade-in">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">👩</span>
                  <div>
                    <h3 className="text-lg font-semibold">Alice (Seller)</h3>
                    <p className="text-sm text-gray-500">Sells BTC → Receives USDC</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--surface-1)]">
                    <p className="text-sm text-gray-500 mb-2">Sending</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold crypto-amount crypto-negative">-1.0</span>
                      <span className="text-orange-400">BTC</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-sm text-gray-500 mb-2">Receiving</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold crypto-amount crypto-positive">+50,000</span>
                      <span className="text-blue-400">USDC</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bob Side */}
              <div className="glass-card p-6 animate-fade-in stagger-1" style={{ opacity: 0 }}>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">👨</span>
                  <div>
                    <h3 className="text-lg font-semibold">Bob (Buyer)</h3>
                    <p className="text-sm text-gray-500">Pays USDC → Receives BTC</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--surface-1)]">
                    <p className="text-sm text-gray-500 mb-2">Sending</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold crypto-amount crypto-negative">-50,000</span>
                      <span className="text-blue-400">USDC</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-sm text-gray-500 mb-2">Receiving</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold crypto-amount crypto-positive">+1.0</span>
                      <span className="text-orange-400">BTC</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Protocol Diagram */}
              <div className="lg:col-span-2 glass-card p-6 animate-fade-in stagger-2" style={{ opacity: 0 }}>
                <h3 className="text-lg font-semibold mb-6 text-center">Cross-Chain Atomic Swap Protocol</h3>

                <div className="flex items-center justify-between max-w-4xl mx-auto">
                  {/* Bitcoin */}
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto mb-3">
                      <BitcoinIcon />
                    </div>
                    <p className="font-medium">Bitcoin</p>
                    <p className="text-xs text-gray-500">HTLC Lock</p>
                  </div>

                  {/* Arrow */}
                  <div className="flex-1 flex items-center justify-center px-4">
                    <div className="w-full h-0.5 bg-gradient-to-r from-orange-500 via-purple-500 to-indigo-500 relative">
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--glass-border)]">
                        <LockIcon />
                      </div>
                    </div>
                  </div>

                  {/* Starknet */}
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" />
                      </svg>
                    </div>
                    <p className="font-medium">Starknet</p>
                    <p className="text-xs text-gray-500">DarkPool Contract</p>
                  </div>

                  {/* Arrow */}
                  <div className="flex-1 flex items-center justify-center px-4">
                    <div className="w-full h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 relative">
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--glass-border)]">
                        <CheckIcon />
                      </div>
                    </div>
                  </div>

                  {/* USDC */}
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto mb-3">
                      <USDCIcon />
                    </div>
                    <p className="font-medium">USDC</p>
                    <p className="text-xs text-gray-500">Settlement</p>
                  </div>
                </div>

                <div className="mt-8 p-4 rounded-xl bg-[var(--surface-1)] text-center">
                  <p className="text-sm text-gray-400">
                    <span className="text-indigo-400 font-medium">🔐 Zero Trust Required</span> — The same secret hash (H) links both chains.
                    When Alice reveals the secret on Starknet, Bob can use it to claim Bitcoin.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[var(--glass-border)]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © 2024 ShadowSwap. Privacy-preserving cross-chain atomic swaps.
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <a href="#" className="hover:text-indigo-400 transition-colors">Docs</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">GitHub</a>
            <a href="#" className="hover:text-indigo-400 transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
