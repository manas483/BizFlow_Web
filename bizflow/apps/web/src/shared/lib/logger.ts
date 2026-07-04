// src/shared/lib/logger.ts
import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';

export interface LogContext {
  requestId?: string;
  route?: string;
  method?: string;
  userId?: string;
  businessId?: string;
  _queryCache?: Map<string, any>;
  [key: string]: any;
}

export const requestContext = new AsyncLocalStorage<LogContext>();

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  category?: string;
  event?: string;
  message?: string;
  [key: string]: any;
}

// Pluggable transports
export interface LogTransport {
  log(level: LogLevel, data: any): void;
}

class ConsoleTransport implements LogTransport {
  log(level: LogLevel, data: any) {
    const json = JSON.stringify(data);
    switch (level) {
      case 'error':
        console.error(json);
        break;
      case 'warn':
        console.warn(json);
        break;
      case 'info':
      case 'debug':
        console.log(json);
        break;
    }
  }
}

// Global transports
const transports: LogTransport[] = [new ConsoleTransport()];

const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'secret', 'otpToken', 'jwt', 'sessionToken'];

function sanitize(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitize(value);
    }
  }
  return sanitized;
}

function processLog(level: LogLevel, payload: LogPayload | string, meta?: any) {
  let data: any = {};
  
  if (typeof payload === 'string') {
    data.message = payload;
    if (meta) {
      if (meta instanceof Error) {
        data.error = { message: meta.message, stack: meta.stack };
      } else {
        data = { ...data, ...meta };
      }
    }
  } else {
    data = { ...payload };
    if (meta instanceof Error) {
      data.error = { message: meta.message, stack: meta.stack };
    }
  }
  
  // Attach correlation ID and metadata from request context
  const ctx = requestContext.getStore();
  if (ctx) {
    if (ctx.requestId) data.reqId = ctx.requestId;
    if (ctx.userId) data.userId = ctx.userId;
    if (ctx.businessId) data.businessId = ctx.businessId;
  } else {
    // If we're outside a request context but need an ID
    data.reqId = crypto.randomUUID(); 
  }

  data.timestamp = new Date().toISOString();
  data.level = level.toUpperCase();

  const safeData = sanitize(data);
  transports.forEach(t => t.log(level, safeData));
}

export const logger = {
  info: (payload: LogPayload | string, meta?: any) => processLog('info', payload, meta),
  warn: (payload: LogPayload | string, meta?: any) => processLog('warn', payload, meta),
  error: (payload: LogPayload | string, meta?: any) => processLog('error', payload, meta),
  debug: (payload: LogPayload | string, meta?: any) => processLog('debug', payload, meta),
};
