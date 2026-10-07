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
    expect(screen.getAllByText(/VERIFIED EVIDENCE REPLAY/).length).toBeGreaterThan(0);
    expect(screen.getByText(/previously executed Arc Testnet run/)).toBeTruthy();
    expect(screen.getByText(/No new transaction is broadcast from this browser/)).toBeTruthy();
    expect(screen.queryByText(/Arc Mainnet verified/i)).toBeNull();
  });

  it("starts in configuration without exposing a verdict, proof, or qualification matrix", () => {
    render(<App />);

    expect(screen.getByText("READY")).toBeTruthy();
    expect(screen.getByRole("button", { name: /RUN ECONOMIC TEST/i })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /ECONOMIC INTENT.*PRESERVED/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /VERIFY IT/i })).toBeNull();
    expect(screen.queryByText(/OBSERVED SETTLEMENTS/i)).toBeNull();
    expect(screen.queryByText(/OPEN VALIDATION RECORD/)).toBeTruthy();
    expect(screen.queryByText(/5c3a95adc37d/)).toBeNull();
  });

  it("keeps successful receipt status separate from an unsafe economic failure", async () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /RUN ECONOMIC TEST/i }));
    expect(screen.getByText("EXECUTING")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /ECONOMIC INTENT.*NOT PRESERVED/i })).toBeNull();
    await finishReplay();

    expect(screen.getByRole("heading", { name: /ECONOMIC INTENT.*NOT PRESERVED/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /VERIFY IT/i })).toBeTruthy();
    expect(screen.getAllByText("SUCCESS").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/0\.020000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/SAME ECONOMIC INTENT/i)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /VIEW ORIGINAL TESTNET TRANSACTION/i })).toHaveLength(2);
  });

  it("clears the prior verdict when switching implementation and replays fixed evidence", async () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /RUN ECONOMIC TEST/i }));
    await finishReplay();
    expect(screen.getByRole("heading", { name: /ECONOMIC INTENT.*NOT PRESERVED/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /IDEMPOTENT/i }));
    expect(screen.queryByRole("heading", { name: /ECONOMIC INTENT.*NOT PRESERVED/ })).toBeNull();
    expect(screen.getByText("READY")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /RUN ECONOMIC TEST/i }));
    await finishReplay();

    expect(screen.getByRole("heading", { name: /ECONOMIC INTENT.*PRESERVED/ })).toBeTruthy();
    expect(screen.getByText(/DUPLICATE PREVENTED/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /VERIFY IT/i })).toBeTruthy();
    expect(screen.getAllByText(/0\.010000/).length).toBeGreaterThan(0);
  });

  it("keeps proof details hidden until economic reconciliation is complete", async () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /RUN ECONOMIC TEST/i }));
    expect(screen.queryByRole("heading", { name: /VERIFY IT/i })).toBeNull();
    await finishReplay();
    expect(screen.getByRole("heading", { name: /VERIFY IT/i })).toBeTruthy();
  });

  it("derives the receipt count and recipient movement shown in proof from its evidence record", async () => {
    vi.useFakeTimers();
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /RUN ECONOMIC TEST/i }));
    await finishReplay();

    expect(screen.getByText("2 / 2 SUCCESSFUL")).toBeTruthy();
    expect(screen.getByText("2 / 2 MATCHED")).toBeTruthy();
    expect(screen.getAllByText(/0\.020000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/chain ID 5042002/)).toBeTruthy();
  });
});
