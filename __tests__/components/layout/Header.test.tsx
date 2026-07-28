/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import Header from "@/components/layout/Header";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/hooks/useWallet";

jest.mock("@/context/AuthContext");
jest.mock("@/hooks/useWallet");

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseWallet = useWallet as jest.Mock;

describe("Header navigation", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      signOut: jest.fn(),
      user: null,
    });
    mockUseWallet.mockReturnValue({
      disconnect: jest.fn(),
      isConnected: false,
      publicKey: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("uses absolute home-page anchor links from every route", () => {
    render(<Header />);

    expect(screen.getByRole("link", { name: "Features" }).getAttribute("href")).toBe(
      "/#features"
    );
    expect(screen.getByRole("link", { name: "How It Works" }).getAttribute("href")).toBe(
      "/#how-it-works"
    );
    expect(screen.getByRole("link", { name: "Pricing" }).getAttribute("href")).toBe(
      "/#pricing"
    );
  });
});
