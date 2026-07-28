import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { fetchContractEvents, parsePaymentEvent } from "@/lib/stellar/events";
import { sorobanServer } from "@/lib/stellar/soroban";

jest.mock("@/lib/stellar/soroban", () => ({
  sorobanServer: {
    getEvents: jest.fn(),
    getLatestLedger: jest.fn(),
  },
}));

function rawPaymentEvent(index: number) {
  return {
    ledger: 100 + index,
    ledgerClosedAt: "2024-01-01T00:00:00Z",
    txHash: `tx-${index}`,
    topic: [
      xdr.ScVal.scvSymbol("pmt_rec"),
      nativeToScVal("trip-1", { type: "string" }),
    ],
    value: nativeToScVal([`exp-${index}`, "GAAAA", String(index)]),
  };
}

describe("parsePaymentEvent", () => {
  it("parses legacy tuple event payloads", () => {
    const raw = {
      ledger: 101,
      ledgerClosedAt: "2024-01-01T00:00:00Z",
      txHash: "abc123",
      topic: [
        xdr.ScVal.scvSymbol("pmt_rec"),
        nativeToScVal("trip-1", { type: "string" }),
      ],
      value: nativeToScVal(["exp-1", "GAAAA", "2500000"]),
    };

    const parsed = parsePaymentEvent(raw);

    expect(parsed).not.toBeNull();
    expect(parsed).toEqual({
      ledger: 101,
      ledgerClosedAt: "2024-01-01T00:00:00Z",
      tripId: "trip-1",
      expenseId: "exp-1",
      member: "GAAAA",
      amountStroops: "2500000",
      txHash: "abc123",
    });
  });

  it("parses structured object event payloads", () => {
    const raw = {
      ledger: 202,
      ledgerClosedAt: "2024-01-02T00:00:00Z",
      txHash: "def456",
      topic: [
        xdr.ScVal.scvSymbol("pmt_rec"),
        nativeToScVal("trip-2", { type: "string" }),
      ],
      value: nativeToScVal({
        expense_id: "exp-2",
        member: "GBBBB",
        amount: "700",
      }),
    };

    const parsed = parsePaymentEvent(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.tripId).toBe("trip-2");
    expect(parsed?.expenseId).toBe("exp-2");
    expect(parsed?.member).toBe("GBBBB");
    expect(parsed?.amountStroops).toBe("700");
  });

  it("returns null when trip ID is missing", () => {
    const raw = {
      topic: [xdr.ScVal.scvSymbol("pmt_rec")],
      value: nativeToScVal(["exp-3", "GCCCC", "10"]),
    };

    expect(parsePaymentEvent(raw)).toBeNull();
  });

  // Verification that the parser correctly extracts independent events belonging to the same member.
  it("parses multiple events from the same member correctly", () => {
    const rawEvents = [
      {
        ledger: 101,
        ledgerClosedAt: "2024-01-01T00:00:00Z",
        txHash: "abc123",
        topic: [
          xdr.ScVal.scvSymbol("pmt_rec"),
          nativeToScVal("trip-1", { type: "string" }),
        ],
        value: nativeToScVal(["exp-1", "GAAAA", "2500000"]),
      },
      {
        ledger: 102,
        ledgerClosedAt: "2024-01-01T00:05:00Z",
        txHash: "def456",
        topic: [
          xdr.ScVal.scvSymbol("pmt_rec"),
          nativeToScVal("trip-1", { type: "string" }),
        ],
        value: nativeToScVal(["exp-2", "GAAAA", "3500000"]),
      },
    ];

    const parsed1 = parsePaymentEvent(rawEvents[0]);
    const parsed2 = parsePaymentEvent(rawEvents[1]);

    expect(parsed1).toEqual(expect.objectContaining({
      expenseId: "exp-1",
      member: "GAAAA",
      amountStroops: "2500000",
    }));

    expect(parsed2).toEqual(expect.objectContaining({
      expenseId: "exp-2",
      member: "GAAAA",
      amountStroops: "3500000",
    }));
  });
});

describe("fetchContractEvents", () => {
  beforeEach(() => {
    jest.mocked(sorobanServer.getEvents).mockReset();
    jest.mocked(sorobanServer.getLatestLedger).mockReset();
  });

  it("fetches and parses additional pages when a page reaches the limit", async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => rawPaymentEvent(index));
    const secondPage = [rawPaymentEvent(200), rawPaymentEvent(201)];

    jest.mocked(sorobanServer.getEvents)
      .mockResolvedValueOnce({
        events: firstPage,
        latestLedger: 500,
        cursor: "page-1",
      } as any)
      .mockResolvedValueOnce({
        events: secondPage,
        latestLedger: 501,
        cursor: "page-2",
      } as any);

    const result = await fetchContractEvents(42, "trip-1");

    expect(result.events).toHaveLength(202);
    expect(result.events[0]?.expenseId).toBe("exp-0");
    expect(result.events[201]?.expenseId).toBe("exp-201");
    expect(result.latestLedger).toBe(501);

    expect(sorobanServer.getEvents).toHaveBeenCalledTimes(2);
    expect(sorobanServer.getEvents).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        startLedger: 42,
        pagination: { limit: 200 },
      })
    );
    expect(sorobanServer.getEvents).toHaveBeenNthCalledWith(
      2,
      expect.not.objectContaining({ startLedger: expect.anything() })
    );
    expect(sorobanServer.getEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        pagination: { cursor: "page-1", limit: 200 },
      })
    );
  });
});
