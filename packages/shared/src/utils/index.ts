import { ulid } from 'ulid';
import { createHash } from 'crypto';

export function generateId(): string {
  return ulid();
}

export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function nowMs(): number {
  return Date.now();
}
