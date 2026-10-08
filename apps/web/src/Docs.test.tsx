// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Docs from "./Docs.js";

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
});

describe("first-party documentation surface", () => {
  it("renders the requested getting-started route and links the full nav", () => {
    window.history.replaceState({}, "", "/docs/getting-started");
    render(<Docs />);
    expect(screen.getByRole("heading", { name: "Installation & quickstart" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Documentation" }).querySelectorAll("a")).toHaveLength(7);
    expect(screen.getByText(/bundled reference tests run locally and do not use an RPC, wallet, key, or Mainnet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "@sazume/core on npm" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "@sazume/cli on npm" })).toBeTruthy();
  });

  it("truthfully describes verified Arc Testnet evidence and Mainnet status", () => {
    window.history.replaceState({}, "", "/docs/arc");
    render(<Docs />);
    expect(screen.getByText(/Arc Testnet/)).toBeTruthy();
    expect(screen.getByText(/Mainnet remains not deployed and not tested/)).toBeTruthy();
    expect(screen.getByText(/must not be added/)).toBeTruthy();
  });

  it("confirms when a code sample has been copied", async () => {
    window.history.replaceState({}, "", "/docs/getting-started");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<Docs />);
    fireEvent.click(screen.getAllByRole("button", { name: "Copy code" })[0]!);
    await waitFor(() => expect(screen.getByRole("button", { name: "Code copied to clipboard" })).toBeTruthy());
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
