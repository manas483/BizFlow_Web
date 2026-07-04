// src/shared/lib/correlation.ts
import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';

interface RequestContext {
  reqId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getCorrelationId(): string | undefined {
  return requestContext.getStore()?.reqId;
}

export function withCorrelationId<T>(callback: () => T, existingId?: string): T {
  const reqId = existingId || crypto.randomUUID();
  return requestContext.run({ reqId }, callback);
}
