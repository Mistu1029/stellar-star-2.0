/**
 * @jest-environment jsdom
 *
 * Unit tests for <QRCodeDisplay /> and <QRToggle />.
 *
 * Dependencies mocked:
 *  - qrcode.react  → QRCodeSVG renders as a plain <svg> to avoid canvas issues
 *  - framer-motion → AnimatePresence / motion.div stubbed for jsdom
 *  - navigator.clipboard → mocked write API to test copy behaviour
 *
 * Tests cover:
 *  - Renders QR code SVG
 *  - Displays formatted XLM amount (4 decimal places)
 *  - Displays correct wallet info text
 *  - Copy button text starts as "Copy payment link"
 *  - Clicking Copy writes the correct URI to the clipboard
 *  - Copy button text changes to "Copied!" after clicking
 *  - QRToggle: panel is hidden by default
 *  - QRToggle: clicking the trigger shows the QR panel
 *  - QRToggle: clicking the trigger again hides the panel
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QRCodeDisplay, QRToggle } from "@/components/payment/QRCodeDisplay";
import type { QRPaymentData } from "@/lib/qr/generator";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Stub QRCodeSVG to avoid canvas / SVG rendering issues in jsdom
jest.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <svg data-testid="qr-svg" data-value={value} />
  ),
}));

// Stub framer-motion so AnimatePresence renders its children directly
jest.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  },
}));

// ─── Clipboard mock ───────────────────────────────────────────────────────────

let clipboardWritten: string | null = null;

beforeEach(() => {
  clipboardWritten = null;
  Object.defineProperty(navigator, "clipboard", {
    writable: true,
    value: {
      writeText: jest.fn((text: string) => {
        clipboardWritten = text;
        return Promise.resolve();
      }),
    },
  });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runAllTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ─── Test data ────────────────────────────────────────────────────────────────

const testData: QRPaymentData = {
  destination: "GDQAXCC66ZI3RLPA72TTWGI2MN6K4LH3JEM6NKXKR7LPJ3R7OYIJF5LV",
  amount: "25.5",
  memo: "Trip split",
};

// ─── QRCodeDisplay ────────────────────────────────────────────────────────────

describe("QRCodeDisplay — rendering", () => {
  it("renders a QR code SVG element", () => {
    render(<QRCodeDisplay data={testData} />);
    expect(screen.getByTestId("qr-svg")).toBeTruthy();
  });

  it("shows the amount formatted to 4 decimal places", () => {
    render(<QRCodeDisplay data={testData} />);
    expect(screen.getByText(/25\.5000 XLM/i)).toBeTruthy();
  });

  it("shows 'Scan to pay' label with the formatted amount", () => {
    render(<QRCodeDisplay data={testData} />);
    expect(screen.getByText(/scan to pay 25\.5000 XLM/i)).toBeTruthy();
  });

  it("shows the compatible wallet note", () => {
    render(<QRCodeDisplay data={testData} />);
    expect(screen.getByText(/freighter.*lobstr.*sep-0007/i)).toBeTruthy();
  });

  it("shows 'Copy payment link' button text by default", () => {
    render(<QRCodeDisplay data={testData} />);
    expect(screen.getByText(/copy payment link/i)).toBeTruthy();
  });

  it("passes the correct SEP-0007 URI value to the QR component", () => {
    render(<QRCodeDisplay data={testData} />);
    const qrSvg = screen.getByTestId("qr-svg");
    const uri = qrSvg.getAttribute("data-value") ?? "";
    expect(uri).toContain("web+stellar:pay");
    expect(uri).toContain(testData.destination);
    expect(uri).toContain(testData.amount);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("QRCodeDisplay — copy to clipboard", () => {
  it("copies the payment URI to the clipboard when Copy is clicked", async () => {
    render(<QRCodeDisplay data={testData} />);
    const copyBtn = screen.getByText(/copy payment link/i).closest("button")!;

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(clipboardWritten).not.toBeNull();
    expect(clipboardWritten).toContain("web+stellar:pay");
    expect(clipboardWritten).toContain(testData.destination);
  });

  it("changes button text to 'Copied!' immediately after clicking copy", async () => {
    render(<QRCodeDisplay data={testData} />);
    const copyBtn = screen.getByText(/copy payment link/i).closest("button")!;

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(screen.getByText(/copied!/i)).toBeTruthy();
  });

  it("reverts the button text back to 'Copy payment link' after 2 seconds", async () => {
    render(<QRCodeDisplay data={testData} />);
    const copyBtn = screen.getByText(/copy payment link/i).closest("button")!;

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(screen.getByText(/copied!/i)).toBeTruthy();

    // Advance the fake timer past the 2-second reset
    act(() => {
      jest.advanceTimersByTime(2100);
    });

    expect(screen.getByText(/copy payment link/i)).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("QRCodeDisplay — data edge cases", () => {
  it("renders when there is no memo field", () => {
    const dataNoMemo: QRPaymentData = {
      destination: "GAYP4BR4UCI2OT6T7OMVZWWDGCFXHCB7NH64UNGPUHSND3F5SJKBS7AU",
      amount: "10",
    };
    render(<QRCodeDisplay data={dataNoMemo} />);
    expect(screen.getByTestId("qr-svg")).toBeTruthy();
    expect(screen.getByText(/10\.0000 XLM/i)).toBeTruthy();
  });

  it("URI does not contain memo_type when memo is absent", async () => {
    const dataNoMemo: QRPaymentData = {
      destination: "GAYP4BR4UCI2OT6T7OMVZWWDGCFXHCB7NH64UNGPUHSND3F5SJKBS7AU",
      amount: "10",
    };
    render(<QRCodeDisplay data={dataNoMemo} />);
    const qrSvg = screen.getByTestId("qr-svg");
    const uri = qrSvg.getAttribute("data-value") ?? "";
    expect(uri).not.toContain("memo_type");
  });
});

// ─── QRToggle ─────────────────────────────────────────────────────────────────

describe("QRToggle — show / hide behaviour", () => {
  it("does NOT show the QR panel by default", () => {
    render(<QRToggle data={testData} />);
    expect(screen.queryByTestId("qr-svg")).toBeNull();
  });

  it("shows the QR panel after clicking the trigger button", () => {
    render(<QRToggle data={testData} />);
    const trigger = screen.getByRole("button", { name: /qr code/i });
    fireEvent.click(trigger);
    expect(screen.getByTestId("qr-svg")).toBeTruthy();
  });

  it("displays 'QR Code' label when panel is closed", () => {
    render(<QRToggle data={testData} />);
    expect(screen.getByText(/qr code/i)).toBeTruthy();
  });

  it("displays 'Hide QR' label when panel is open", () => {
    render(<QRToggle data={testData} />);
    const trigger = screen.getByRole("button", { name: /qr code/i });
    fireEvent.click(trigger);
    expect(screen.getByText(/hide qr/i)).toBeTruthy();
  });

  it("hides the QR panel again when the trigger is clicked a second time", () => {
    const { container } = render(<QRToggle data={testData} />);
    const triggerBtn = container.querySelector<HTMLButtonElement>("button[title='Show QR code']")!;

    // Open
    fireEvent.click(triggerBtn);
    expect(screen.getByTestId("qr-svg")).toBeTruthy();

    // Close — re-query the trigger by title after state update
    const closeTrigger = container.querySelector<HTMLButtonElement>("button[title='Show QR code']")!;
    fireEvent.click(closeTrigger);
    expect(screen.queryByTestId("qr-svg")).toBeNull();
  });
});
