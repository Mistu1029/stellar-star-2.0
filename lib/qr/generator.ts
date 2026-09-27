/**
 * SEP-0007 compliant QR payment URI builder.
 * web+stellar:pay? URIs are understood by Freighter, Lobstr, and most
 * Stellar wallets - scanning the QR auto-fills the payment form.
 *
 * Spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 */

import { StrKey } from "@stellar/stellar-sdk";
import { trimToMemoBytes } from "@/lib/stellar/buildTransaction";

export interface QRPaymentData {
  /** Destination Stellar address (G...) */
  destination: string;
  /** Payment amount as string e.g. "300.0000000" */
  amount: string;
  /** Human-readable memo - will be truncated to 28 bytes */
  memo?: string;
  /** Asset code for non-native assets (e.g. "USDC") */
  assetCode?: string;
  /** Account ID of the asset issuer for non-native assets */
  assetIssuer?: string;
}

/**
 * Returns a `web+stellar:pay?...` URI.
 * Any SEP-0007-compatible wallet can parse this to pre-fill the payment.
 */
export function buildQRPaymentURI({
  destination,
  amount,
  memo,
  assetCode,
  assetIssuer,
}: QRPaymentData): string {
  if (!StrKey.isValidEd25519PublicKey(destination)) {
    throw new Error(`Invalid destination address: "${destination}". Must be a valid Stellar public key.`);
  }

  if (assetIssuer && !StrKey.isValidEd25519PublicKey(assetIssuer)) {
    throw new Error(`Invalid asset issuer address: "${assetIssuer}". Must be a valid Stellar public key.`);
  }

  const params = new URLSearchParams({
    destination,
    amount,
  });

  if (assetCode) {
    params.set("asset_code", assetCode);
  }

  if (assetIssuer) {
    params.set("asset_issuer", assetIssuer);
  }

  if (memo) {
    const finalMemo = trimToMemoBytes(memo, 28);
    params.set("memo", finalMemo);
    params.set("memo_type", "MEMO_TEXT");
  }

  return `web+stellar:pay?${params.toString()}`;
}
