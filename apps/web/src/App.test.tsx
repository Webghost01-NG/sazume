// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function finishReplay() {
  for (let index = 0; index < 20; index += 1) {
    await act(async () => vi.advanceTimersByTimeAsync(540));
  }
}

describe("Sazume evidence replay interface", () => {
  it("labels the network and replay honestly without claiming Mainnet verification", () => {
    render(<App />);

    expect(screen.getAllByText(/ARC TESTNET/).length).toBeGreaterThan(0);
    expect(screen.getByText(/VERIFIED EVIDENCE REPLAY/)).toBeTruthy();
    expect(screen.getByText(/No transaction is broadcast from this browser/)).toBeTruthy();
    expect(screen.queryByText(/Arc Mainnet verified/i)).toBeNull();
  });

  it("keeps successful receipt status separate from an unsafe economic failure", async () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /RUN TEST/i }));
    await finishReplay();

    expect(screen.getByRole("heading", { name: /ECONOMIC INTENT.*NOT PRESERVED/ })).toBeTruthy();
    expect(screen.getByText(/2 SUCCESS/)).toBeTruthy();
    expect(screen.getByText(/0.020000 USDC/)).toBeTruthy();
  });

  it("clears the prior verdict when switching implementation and replays fixed evidence", async () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /RUN TEST/i }));
    await finishReplay();
    expect(screen.getByRole("heading", { name: /ECONOMIC INTENT.*NOT PRESERVED/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /FIXED/i }));
    expect(screen.queryByRole("heading", { name: /ECONOMIC INTENT.*NOT PRESERVED/ })).toBeNull();
    expect(screen.getByText("AWAITING REPLAY")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /RUN TEST/i }));
    await finishReplay();

    expect(screen.getByRole("heading", { name: /ECONOMIC INTENT.*PRESERVED/ })).toBeTruthy();
    expect(document.querySelector(".receipt-strip")?.textContent).toMatch(/1.*SUCCESS.*1.*REVERTED/);
  });
});
