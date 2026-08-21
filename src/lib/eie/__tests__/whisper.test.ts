import { describe, expect, it } from "vitest";
import { resolveOpenRouterAudioFormat } from "@/lib/eie/transcription/whisper";

describe("resolveOpenRouterAudioFormat", () => {
  it("maps WhatsApp-style mp4 voice notes to m4a", () => {
    expect(resolveOpenRouterAudioFormat("video/mp4", "WhatsApp Audio 2026.mp4")).toBe("m4a");
    expect(resolveOpenRouterAudioFormat("audio/mp4", "voice.mp4")).toBe("m4a");
  });

  it("maps common audio and video mime types", () => {
    expect(resolveOpenRouterAudioFormat("audio/mpeg", "clip.mp3")).toBe("mp3");
    expect(resolveOpenRouterAudioFormat("video/webm", "clip.webm")).toBe("webm");
    expect(resolveOpenRouterAudioFormat("audio/m4a", "clip.m4a")).toBe("m4a");
  });
});
