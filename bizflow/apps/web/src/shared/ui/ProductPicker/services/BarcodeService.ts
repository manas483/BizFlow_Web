import { BEEP_FREQ_SUCCESS, BEEP_FREQ_ERROR } from "../constants";

export class BarcodeService {
  private static audioCtx: AudioContext | null = null;

  /**
   * Initializes or returns the audio context.
   */
  private static getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    return this.audioCtx;
  }

  /**
   * Plays a synthesized beep for immediate audial feedback during barcode scans.
   */
  static playBeep(type: "success" | "error" = "success") {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      // Resume context if suspended (browser security policy)
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === "success") {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(BEEP_FREQ_SUCCESS, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.05, ctx.currentTime); // Low volume
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
      } else {
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(BEEP_FREQ_ERROR, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {
      console.warn("Web Audio API beep blocked or failed:", e);
    }
  }

  /**
   * Sanitizes barcode scanner input.
   */
  static parseBarcode(input: string): string {
    return input.trim();
  }

  /**
   * Cleans up resources.
   */
  static dispose() {
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
