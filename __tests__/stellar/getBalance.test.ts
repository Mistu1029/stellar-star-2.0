import { getXLMBalance } from "@/lib/stellar/getBalance";
import { HORIZON_URL } from "@/lib/utils/constants";

describe("getXLMBalance", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        balances: [{ asset_type: "native", balance: "12.5000000" }],
      }),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("forwards an abort signal to Horizon fetch requests", async () => {
    const controller = new AbortController();

    const balance = await getXLMBalance("GTESTPUBLICKEY", controller.signal);

    expect(balance).toBe("12.5000000");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`${HORIZON_URL}/accounts/GTESTPUBLICKEY`),
      expect.objectContaining({ signal: controller.signal })
    );
  });
});
