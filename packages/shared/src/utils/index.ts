import { ulid } from 'ulid';

export function generateId(): string {
  return ulid();
}

export function nowMs(): number {
  return Date.now();
}
