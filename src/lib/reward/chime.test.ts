import { describe, it, expect, vi } from "vitest";
import { playChime } from "@/lib/reward/chime";
describe("playChime", () => {
  it("is a no-op when AudioContext is unavailable", () => {
    const g = globalThis as Record<string, unknown>;
    const prevAC = g.AudioContext, prevWk = g.webkitAudioContext;
    delete g.AudioContext; delete g.webkitAudioContext;
    expect(() => playChime()).not.toThrow();
    g.AudioContext = prevAC; g.webkitAudioContext = prevWk;
  });
  it("builds an oscillator when AudioContext exists", () => {
    const start = vi.fn(), stop = vi.fn(), connect = vi.fn();
    const osc = { connect, start, stop, frequency: { setValueAtTime: vi.fn() }, type: "" };
    const gain = { connect, gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } };
    const ctx = { createOscillator: () => osc, createGain: () => gain, destination: {}, currentTime: 0, close: vi.fn() };
    (globalThis as Record<string, unknown>).AudioContext = vi.fn(() => ctx);
    playChime();
    expect(start).toHaveBeenCalled();
  });
});
