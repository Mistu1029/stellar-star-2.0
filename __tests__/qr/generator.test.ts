import { buildQRPaymentURI } from "@/lib/qr/generator";

describe("buildQRPaymentURI", () => {
  const destination = "GBGJFHVDS5CQJCFGGLOFMFXZJ3RCUZHDNJV5PBSYVLVQNKFX7SRP7CDR";
  const amount = "10.0000000";

  it("constructs a correct web+stellar:pay URI without memo", () => {
    const uri = buildQRPaymentURI({ destination, amount });
    const url = new URL(uri.replace("web+stellar:pay", "https://stellar"));
    expect(url.searchParams.get("destination")).toBe(destination);
    expect(url.searchParams.get("amount")).toBe(amount);
    expect(url.searchParams.get("memo")).toBeNull();
  });

  it("includes short memo untouched", () => {
    const memo = "Short Memo";
    const uri = buildQRPaymentURI({ destination, amount, memo });
    const url = new URL(uri.replace("web+stellar:pay", "https://stellar"));
    expect(url.searchParams.get("memo")).toBe(memo);
    expect(url.searchParams.get("memo_type")).toBe("MEMO_TEXT");
  });

  it("truncates long ASCII memo to exactly 28 bytes", () => {
    const memo = "This is a very long memo exceeding 28 characters";
    const uri = buildQRPaymentURI({ destination, amount, memo });
    const url = new URL(uri.replace("web+stellar:pay", "https://stellar"));
    const resultMemo = url.searchParams.get("memo") || "";
    
    expect(resultMemo.length).toBe(28);
    expect(new TextEncoder().encode(resultMemo).length).toBe(28);
    expect(resultMemo).toBe("This is a very long memo exc");
  });

  it("truncates multi-byte string (emojis) without producing malformed UTF-8", () => {
    // Emojis are multi-byte. e.g. 🍕 is 4 bytes: F0 9F 8D 95
    // Let's create a memo that cuts a 4-byte emoji in the middle.
    // "12345678901234567890123456" is 26 bytes.
    // If we append 🍕 (4 bytes), the total is 30 bytes.
    // Truncating to 28 bytes leaves 2 bytes of the emoji.
    // Our logic should drop the partial emoji (U+FFFD) entirely, resulting in 26 bytes memo.
    const memo = "12345678901234567890123456🍕";
    const uri = buildQRPaymentURI({ destination, amount, memo });
    const url = new URL(uri.replace("web+stellar:pay", "https://stellar"));
    const resultMemo = url.searchParams.get("memo") || "";

    expect(new TextEncoder().encode(resultMemo).length).toBe(26);
    expect(resultMemo).toBe("12345678901234567890123456");
    expect(resultMemo).not.toContain("\uFFFD");
  });

  it("truncates safely if the cut happens exactly at emoji boundary", () => {
    // 🍕 is 4 bytes.
    // "123456789012345678901234" is 24 bytes.
    // Total is 28 bytes (exactly 28). It should keep the emoji.
    const memo = "123456789012345678901234🍕";
    const uri = buildQRPaymentURI({ destination, amount, memo });
    const url = new URL(uri.replace("web+stellar:pay", "https://stellar"));
    const resultMemo = url.searchParams.get("memo") || "";

    expect(new TextEncoder().encode(resultMemo).length).toBe(28);
    expect(resultMemo).toBe("123456789012345678901234🍕");
  });

  describe("destination validation", () => {
    it("throws an error when destination is not a valid Stellar Ed25519 public key", () => {
      expect(() => {
        buildQRPaymentURI({ destination: "invalid-address", amount });
      }).toThrow(/Invalid destination address/);
    });

    it("throws an error when destination is a secret key or malformed", () => {
      expect(() => {
        buildQRPaymentURI({
          destination: "SBGJFHVDS5CQJCFGGLOFMFXZJ3RCUZHDNJV5PBSYVLVQNKFX7SRP7CDR",
          amount,
        });
      }).toThrow(/Invalid destination address/);
    });
  });

  describe("non-native assets", () => {
    const issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

    it("includes asset_code and asset_issuer when both are provided", () => {
      const uri = buildQRPaymentURI({
        destination,
        amount,
        assetCode: "USDC",
        assetIssuer: issuer,
      });
      const url = new URL(uri.replace("web+stellar:pay", "https://stellar"));
      expect(url.searchParams.get("destination")).toBe(destination);
      expect(url.searchParams.get("amount")).toBe(amount);
      expect(url.searchParams.get("asset_code")).toBe("USDC");
      expect(url.searchParams.get("asset_issuer")).toBe(issuer);
    });

    it("includes asset_code without asset_issuer when only assetCode is provided", () => {
      const uri = buildQRPaymentURI({
        destination,
        amount,
        assetCode: "USDC",
      });
      const url = new URL(uri.replace("web+stellar:pay", "https://stellar"));
      expect(url.searchParams.get("asset_code")).toBe("USDC");
      expect(url.searchParams.get("asset_issuer")).toBeNull();
    });

    it("throws an error when assetIssuer is invalid", () => {
      expect(() => {
        buildQRPaymentURI({
          destination,
          amount,
          assetCode: "USDC",
          assetIssuer: "not-a-valid-issuer",
        });
      }).toThrow(/Invalid asset issuer address/);
    });

    it("omits asset_code and asset_issuer when neither is provided", () => {
      const uri = buildQRPaymentURI({ destination, amount });
      const url = new URL(uri.replace("web+stellar:pay", "https://stellar"));
      expect(url.searchParams.get("asset_code")).toBeNull();
      expect(url.searchParams.get("asset_issuer")).toBeNull();
    });
  });
});
