export interface SlowQueryRecord {
  timestamp: string;
  reqId?: string;
  userId?: string;
  businessId?: string;
  model: string;
  operation: string;
  durationMs: number;
  rowsReturned: number;
  route?: string;
}

const MAX_BUFFER_SIZE = 100;

class SlowQueryBuffer {
  private buffer: SlowQueryRecord[] = [];

  add(record: SlowQueryRecord) {
    this.buffer.unshift(record); // Add to the beginning (most recent first)
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.pop(); // Remove the oldest
    }
  }

  get(): SlowQueryRecord[] {
    return [...this.buffer];
  }
}

// Global instance to persist across HMR in dev
const g = globalThis as any;
if (!g.__slowQueryBuffer) {
  g.__slowQueryBuffer = new SlowQueryBuffer();
}

export const slowQueryBuffer: SlowQueryBuffer = g.__slowQueryBuffer;
