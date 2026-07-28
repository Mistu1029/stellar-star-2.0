/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from "@testing-library/react";
import { useBalance } from "@/hooks/useBalance";
import { getXLMBalance } from "@/lib/stellar/getBalance";

jest.mock("@/lib/stellar/getBalance", () => ({
  getXLMBalance: jest.fn(),
}));

const mockedGetXLMBalance = getXLMBalance as jest.MockedFunction<typeof getXLMBalance>;

describe("useBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes an abort signal to balance requests", async () => {
    mockedGetXLMBalance.mockResolvedValue("7.0000000");

    const { result } = renderHook(() => useBalance("GTESTPUBLICKEY"));

    await waitFor(() => {
      expect(result.current.balance).toBe("7.0000000");
    });

    expect(mockedGetXLMBalance).toHaveBeenCalledWith(
      "GTESTPUBLICKEY",
      expect.any(AbortSignal)
    );
  });

  it("aborts the in-flight request when the hook unmounts", async () => {
    let signal: AbortSignal | undefined;
    mockedGetXLMBalance.mockImplementation((_publicKey, requestSignal) => {
      signal = requestSignal;
      return new Promise(() => undefined);
    });

    const { unmount } = renderHook(() => useBalance("GTESTPUBLICKEY"));

    await waitFor(() => {
      expect(signal).toBeDefined();
    });

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
