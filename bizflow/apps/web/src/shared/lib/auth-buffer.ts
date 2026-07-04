export interface AuthFailureRecord {
  timestamp: string;
  reqId?: string;
  email?: string;
  businessId?: string;
  step: string;
  reason: string;
  ip?: string;
  userAgent?: string;
  durationMs?: number;
}

const MAX_BUFFER_SIZE = 100;

class AuthFailureBuffer {
  private buffer: AuthFailureRecord[] = [];

  add(record: AuthFailureRecord) {
    this.buffer.unshift(record); // Add to the beginning (most recent first)
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.pop(); // Remove the oldest
    }
  }

  get(): AuthFailureRecord[] {
    return [...this.buffer];
  }
}

// Global instance to persist across HMR in dev
const g = globalThis as any;
if (!g.__authFailureBuffer) {
  g.__authFailureBuffer = new AuthFailureBuffer();
}

export const authFailureBuffer: AuthFailureBuffer = g.__authFailureBuffer;
