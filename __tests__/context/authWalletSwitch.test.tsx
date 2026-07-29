/** @jest-environment jsdom */

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useWalletContext } from "@/context/WalletContext";
import { LS_PUBLIC_KEY, LS_USER } from "@/lib/utils/constants";

// Mock WalletContext so we can drive `publicKey` directly per test step.
jest.mock("@/context/WalletContext", () => ({
  useWalletContext: jest.fn(),
}));

// Mock Supabase so requests fail (simulating an offline/unreachable backend),
// forcing AuthContext to fall back to whatever is cached in localStorage.
jest.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: jest.fn(() => true),
  supabase: {},
  createAuthenticatedClient: jest.fn(() => {
    throw new Error("Network offline");
  }),
  clearAuthenticatedClientCache: jest.fn(),
}));

const mockUseWalletContext = useWalletContext as jest.Mock;

function TestConsumer({ onContext }: { onContext: (ctx: any) => void }) {
  const ctx = useAuth();
  onContext({ user: ctx.user, isLoading: ctx.isLoading });
  return null;
}

const walletA = "GAAAA_WALLET_A_1111111111111111111111111111111111111111";
const walletB = "GBBBB_WALLET_B_2222222222222222222222222222222222222222";

const userA = {
  id: "user-a",
  walletAddress: walletA,
  displayName: "Alice",
  createdAt: "",
  updatedAt: "",
  lastLoginAt: "",
};

const userB = {
  id: "user-b",
  walletAddress: walletB,
  displayName: "Bob",
  createdAt: "",
  updatedAt: "",
  lastLoginAt: "",
};

describe("Auth user cache isolation by wallet (Issue #68)", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("loads the cached profile for the active wallet and never leaks it to a different wallet after switching", async () => {
    // Seed cached profiles for two different wallets plus an active session for wallet A.
    localStorage.setItem(LS_PUBLIC_KEY, walletA);
    localStorage.setItem("StellarStar:authToken", "token-a");
    localStorage.setItem(`${LS_USER}:${walletA}`, JSON.stringify(userA));
    localStorage.setItem(`${LS_USER}:${walletB}`, JSON.stringify(userB));

    mockUseWalletContext.mockReturnValue({
      publicKey: walletA,
      isConnected: true,
      isHydrated: true,
    });

    let captured: any = { user: undefined, isLoading: true };
    const { rerender } = render(
      <AuthProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </AuthProvider>
    );

    // Backend is unreachable, so AuthContext should fall back to wallet A's cached profile.
    await waitFor(() => {
      expect(captured.isLoading).toBe(false);
    });
    expect(captured.user?.walletAddress).toBe(walletA);
    expect(captured.user?.displayName).toBe("Alice");

    // Disconnect: publicKey goes to null (mirrors WalletContext.disconnect() clearing LS_PUBLIC_KEY too).
    localStorage.removeItem(LS_PUBLIC_KEY);
    mockUseWalletContext.mockReturnValue({
      publicKey: null,
      isConnected: false,
      isHydrated: true,
    });
    rerender(
      <AuthProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(captured.user).toBeNull();
    });
    expect(localStorage.getItem("StellarStar:authToken")).toBeNull();

    // Connect wallet B. No auth session yet (must sign in again) - the previously
    // shown wallet A profile must never reappear for wallet B.
    mockUseWalletContext.mockReturnValue({
      publicKey: walletB,
      isConnected: true,
      isHydrated: true,
    });
    rerender(
      <AuthProvider>
        <TestConsumer onContext={(ctx) => { captured = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(captured.isLoading).toBe(false);
    });
    expect(captured.user).toBeNull();
    expect(captured.user?.displayName).not.toBe("Alice");
  });
});
