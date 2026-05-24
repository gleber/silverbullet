import { describe, expect, it, vi } from "vitest";
import type { Client } from "./client.ts";

// Define minimal browser mocks before importing any UI code
globalThis.document = {
  createElement: () => ({
    setAttribute: () => {},
    style: {},
  }),
  body: {
    style: {},
  },
  documentElement: {
    style: {},
  },
} as any;
globalThis.window = globalThis as any;
globalThis.addEventListener = () => {};

describe("MainUI Progress Tracker", () => {
  it("should guard sync progress from being overridden by index progress", async () => {
    // Dynamically import MainUI so mocks are fully set up first
    const { MainUI } = await import("./editor_ui.tsx");

    // Create a mock Client
    const mockClient = {
      editorView: {
        hasFocus: false,
        dispatch: vi.fn(),
      },
    } as unknown as Client;

    const ui = new MainUI(mockClient);

    // Set up a mock viewDispatch that updates viewState
    ui.viewDispatch = (action: any) => {
      if (action.type === "set-progress") {
        ui.viewState = {
          ...ui.viewState,
          progressPercentage: action.progressPercentage,
          progressType: action.progressType,
        };
      }
    };

    // 1. Initial state: progress should be undefined
    expect(ui.viewState.progressPercentage).toBeUndefined();
    expect(ui.viewState.progressType).toBeUndefined();

    // 2. Set index progress. Should succeed because there's no active sync progress.
    ui.showProgress(10, "index");
    expect(ui.viewState.progressPercentage).toBe(10);
    expect(ui.viewState.progressType).toBe("index");

    // 3. Set sync progress. Should succeed and override index progress.
    ui.showProgress(20, "sync");
    expect(ui.viewState.progressPercentage).toBe(20);
    expect(ui.viewState.progressType).toBe("sync");

    // 4. Try setting index progress now. Should be ignored because sync progress is active.
    ui.showProgress(30, "index");
    expect(ui.viewState.progressPercentage).toBe(20); // still 20!
    expect(ui.viewState.progressType).toBe("sync");

    // 5. Try clearing index progress. Should be ignored because sync progress is active.
    ui.showProgress(undefined, "index");
    expect(ui.viewState.progressPercentage).toBe(20); // still 20!
    expect(ui.viewState.progressType).toBe("sync");

    // 6. Clear sync progress. Should succeed.
    ui.showProgress(undefined, "sync");
    expect(ui.viewState.progressPercentage).toBeUndefined();
  });
});
