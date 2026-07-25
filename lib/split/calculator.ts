import { StrKey } from "@stellar/stellar-sdk";
import type { Member, SplitShare } from "@/types/expense";

function toXLM(n: number): string {
  return n.toFixed(7);
}

export function calculateEqualSplit(
  totalXLM: number,
  members: Member[],
  paidByMemberId: string
): SplitShare[] {
  if (members.length === 0) return [];

  const nonPayers = members.filter((m) => m.id !== paidByMemberId);
  if (nonPayers.length === 0) return [];

  const perHead = totalXLM / members.length;
  const shares: SplitShare[] = [];

  nonPayers.forEach((m, i) => {
    const isLast = i === nonPayers.length - 1;
    const accumulated = shares.reduce((s, x) => s + parseFloat(x.amount), 0);
    const amount = isLast
      ? perHead * nonPayers.length - accumulated
      : perHead;

    shares.push({
      memberId: m.id,
      name: m.name,
      walletAddress: m.walletAddress,
      amount: toXLM(Math.max(0, amount)),
      paid: false,
    });
  });

  return shares;
}

export function calculateCustomSplit(
  totalXLM: number,
  members: Member[],
  paidByMemberId: string
): SplitShare[] {
  if (members.length === 0) return [];

  const totalWeight = members.reduce((s, m) => s + (m.weight ?? 1), 0);
  const shares: SplitShare[] = [];

  members.forEach((m) => {
    if (m.id === paidByMemberId) return;

    const proportion = (m.weight ?? 1) / totalWeight;
    shares.push({
      memberId: m.id,
      name: m.name,
      walletAddress: m.walletAddress,
      amount: toXLM(totalXLM * proportion),
      paid: false,
    });
  });

  return shares;
}

export function calculateSplit(
  totalXLM: number,
  members: Member[],
  paidByMemberId: string,
  mode: "equal" | "custom"
): SplitShare[] {
  return mode === "custom"
    ? calculateCustomSplit(totalXLM, members, paidByMemberId)
    : calculateEqualSplit(totalXLM, members, paidByMemberId);
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export function isValidXLMAmount(value: string): boolean {
  const n = parseFloat(value);
  return !isNaN(n) && n > 0 && n <= 100_000_000;
}

export function isValidStellarAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address);
}

/**
 * Detects members sharing the same Stellar wallet address, comparing
 * trimmed + uppercased values. Only syntactically valid addresses are
 * considered — invalid ones are reported separately by field-level checks.
 * Returns a map of member index -> error message, flagging every member
 * involved in a collision (not just the second occurrence).
 */
export function findDuplicateWalletErrors(
  addresses: Array<string | undefined>
): Record<number, string> {
  const seen = new Map<string, number>();
  const errors: Record<number, string> = {};

  addresses.forEach((address, index) => {
    const raw = address?.trim();
    if (!raw || !isValidStellarAddress(raw)) return;

    const normalised = raw.toUpperCase();
    const firstIndex = seen.get(normalised);
    if (firstIndex === undefined) {
      seen.set(normalised, index);
      return;
    }

    errors[index] = `Duplicate wallet address — already used by member ${firstIndex + 1}.`;
    if (!errors[firstIndex]) {
      errors[firstIndex] = `Duplicate wallet address — also used by member ${index + 1}.`;
    }
  });

  return errors;
}
