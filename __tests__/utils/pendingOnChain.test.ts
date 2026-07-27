/** @jest-environment jsdom */
import {
  savePendingOnChain,
  loadPendingOnChain,
  clearPendingOnChain,
  type PendingOnChainRecord,
} from "@/lib/utils/pendingOnChain";
import { LS_PENDING_ON_CHAIN } from "@/lib/utils/constants";

// ─── helpers ──────────────────────────────────────────────────────────────────

const WALLET_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const WALLET_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function mkRecord(overrides: Partial<PendingOnChainRecord> = {}): PendingOnChainRecord {
  return {
    memberPublicKey: WALLET_A,
    tripId: "trip-1",
    expenseId: "exp-1",
    payerPublicKey: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    amountXlm: "2.0000000",
    memoText: "Dinner|Alice",
    txHash: "tx-hash-1",
    ledger: 100,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

// ─── round-trip ───────────────────────────────────────────────────────────────

describe("savePendingOnChain / loadPendingOnChain", () => {
  it("returns null when nothing has been stored", () => {
    expect(loadPendingOnChain(WALLET_A, "exp-1")).toBeNull();
  });

  it("round-trips a saved record", () => {
    const record = mkRecord();
    savePendingOnChain(WALLET_A, record);
    expect(loadPendingOnChain(WALLET_A, "exp-1")).toEqual(record);
  });

  it("keeps records for different expenses under the same wallet separate", () => {
    savePendingOnChain(WALLET_A, mkRecord({ expenseId: "exp-1", txHash: "hash-1" }));
    savePendingOnChain(WALLET_A, mkRecord({ expenseId: "exp-2", txHash: "hash-2" }));

    expect(loadPendingOnChain(WALLET_A, "exp-1")!.txHash).toBe("hash-1");
    expect(loadPendingOnChain(WALLET_A, "exp-2")!.txHash).toBe("hash-2");
  });

  it("scopes records by wallet so one wallet cannot read another's record", () => {
    savePendingOnChain(WALLET_A, mkRecord({ txHash: "hash-a" }));
    savePendingOnChain(WALLET_B, mkRecord({ memberPublicKey: WALLET_B, txHash: "hash-b" }));

    expect(loadPendingOnChain(WALLET_A, "exp-1")!.txHash).toBe("hash-a");
    expect(loadPendingOnChain(WALLET_B, "exp-1")!.txHash).toBe("hash-b");
  });

  it("overwrites an existing record for the same wallet/expense pair", () => {
    savePendingOnChain(WALLET_A, mkRecord({ txHash: "first" }));
    savePendingOnChain(WALLET_A, mkRecord({ txHash: "second" }));

    expect(loadPendingOnChain(WALLET_A, "exp-1")!.txHash).toBe("second");
  });
});

// ─── clearPendingOnChain ──────────────────────────────────────────────────────

describe("clearPendingOnChain", () => {
  it("removes only the targeted expense record", () => {
    savePendingOnChain(WALLET_A, mkRecord({ expenseId: "exp-1" }));
    savePendingOnChain(WALLET_A, mkRecord({ expenseId: "exp-2" }));

    clearPendingOnChain(WALLET_A, "exp-1");

    expect(loadPendingOnChain(WALLET_A, "exp-1")).toBeNull();
    expect(loadPendingOnChain(WALLET_A, "exp-2")).not.toBeNull();
  });

  it("prunes the wallet-level key once its last expense record is cleared", () => {
    savePendingOnChain(WALLET_A, mkRecord({ expenseId: "exp-only" }));
    clearPendingOnChain(WALLET_A, "exp-only");

    const raw = localStorage.getItem(LS_PENDING_ON_CHAIN);
    const parsed = raw ? JSON.parse(raw) : {};
    expect(parsed[WALLET_A]).toBeUndefined();
  });

  it("is a no-op when clearing a wallet that has no stored records", () => {
    expect(() => clearPendingOnChain(WALLET_A, "exp-1")).not.toThrow();
    expect(loadPendingOnChain(WALLET_A, "exp-1")).toBeNull();
  });
});

// ─── corrupted / unavailable storage ─────────────────────────────────────────

describe("resilience to corrupted or unavailable localStorage", () => {
  it("treats malformed JSON in localStorage as an empty store instead of throwing", () => {
    localStorage.setItem(LS_PENDING_ON_CHAIN, "{not-valid-json");

    expect(() => loadPendingOnChain(WALLET_A, "exp-1")).not.toThrow();
    expect(loadPendingOnChain(WALLET_A, "exp-1")).toBeNull();
  });

  it("recovers from corrupted JSON by allowing a fresh save afterwards", () => {
    localStorage.setItem(LS_PENDING_ON_CHAIN, "]not-json[");

    const record = mkRecord();
    expect(() => savePendingOnChain(WALLET_A, record)).not.toThrow();
    expect(loadPendingOnChain(WALLET_A, "exp-1")).toEqual(record);
  });

  it("does not throw when localStorage.setItem raises (e.g. quota exceeded)", () => {
    const setItemSpy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    expect(() => savePendingOnChain(WALLET_A, mkRecord())).not.toThrow();

    setItemSpy.mockRestore();
  });
});
