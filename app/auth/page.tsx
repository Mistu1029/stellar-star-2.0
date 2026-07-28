"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthAccountForm } from "@/components/auth/AuthAccountForm";
import { AuthWalletConnectPrompt } from "@/components/auth/AuthWalletConnectPrompt";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useWalletContext } from "@/context/WalletContext";

export default function AuthPage() {
  const { signUp, signIn, isLoading } = useAuth();
  const { publicKey, isConnected, connect, disconnect } = useWalletContext();
  const [displayName, setDisplayName] = useState("");
  const [isSignUpMode, setIsSignUpMode] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { success } = useToast();

  const handleModeChange = (nextSignUpMode: boolean) => {
    setIsSignUpMode(nextSignUpMode);
    setError("");
  };

  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    setError("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (isSignUpMode && !displayName.trim()) {
      setError("Please enter your name");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignUpMode) {
        await signUp(displayName.trim());
        success("Account created successfully!");
      } else {
        await signIn();
        success("Welcome back!");
      }
      router.push("/dashboard");
    } catch (err: any) {
      const message: string = err?.message || "";
      if (isSignUpMode && isExistingWalletError(message)) {
        setIsSignUpMode(false);
        setError("This wallet already has an account. Please sign in.");
      } else {
        setError(message || (isSignUpMode ? "Sign up failed. Please try again." : "Sign in failed. Please try again."));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return <AuthWalletConnectPrompt onConnect={connect} />;
  }

  return (
    <AuthAccountForm
      publicKey={publicKey}
      displayName={displayName}
      isSignUpMode={isSignUpMode}
      isSubmitting={isSubmitting}
      isLoading={isLoading}
      error={error}
      onDisplayNameChange={handleDisplayNameChange}
      onModeChange={handleModeChange}
      onSubmit={handleSubmit}
      onDisconnect={disconnect}
    />
  );
}

function isExistingWalletError(message: string) {
  return (
    message.includes("already registered") ||
    message.includes("sign in instead") ||
    message.includes("23505")
  );
}
