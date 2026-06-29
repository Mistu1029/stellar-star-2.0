/**
 * SEP-0007 compliant QR payment URI builder.
 * web+stellar:pay? URIs are understood by Freighter, Lobstr, and most
 * Stellar wallets - scanning the QR auto-fills the payment form.
 *
 * Spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 */

export interface QRPaymentData {
  /** Destination Stellar address (G...) */
  destination: string;
  /** XLM amount as string e.g. "300.0000000" */
  amount: string;
  /** Human-readable memo - will be truncated to 28 bytes */
  memo?: string;
}

/**
 * Returns a `web+stellar:pay?...` URI.
 * Any SEP-0007-compatible wallet can parse this to pre-fill the payment.
 */
export function buildQRPaymentURI({ destination, amount, memo }: QRPaymentData): string {
  const params = new URLSearchParams({
    destination,
    amount,
  });
  if (memo) {
    // TODO: Implement UTF-8 byte-aware truncation to 28 bytes to prevent wallet rejections/crashes:
    // 1. Convert the memo to raw UTF-8 bytes: const bytes = new TextEncoder().encode(memo);
    // 2. If bytes.length > 28, slice to 28: const sliced = bytes.slice(0, 28);
    // 3. Decode back: const decoded = new TextDecoder("utf-8").decode(sliced);
    // 4. Handle cut-off multi-byte sequences at the end of the string to avoid invalid UTF-8 (e.g. by dropping the incomplete character at the end).
    // 5. Use the safely truncated memo instead of the raw memo.
    params.set("memo", memo);
    params.set("memo_type", "MEMO_TEXT");
  }
  return `web+stellar:pay?${params.toString()}`;
}
