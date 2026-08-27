import { describe, expect, it } from 'vitest';
import {
  accessStatusRedirect,
  messageForError,
  normalizeEmail,
  routeFor,
  safeReturnTo,
} from './auth';

describe('auth utilities', () => {
  it('normalizes email identifiers', () =>
    expect(normalizeEmail(' Family@Example.COM ')).toBe('family@example.com'));
  it('accepts only internal return paths', () => {
    expect(safeReturnTo('/app/members')).toBe('/app/members');
    expect(safeReturnTo('//evil.example')).toBe('/app');
    expect(safeReturnTo('https://evil.example')).toBe('/app');
  });
  it('routes every access state without trusting UI metadata', () => {
    expect(routeFor({ kind: 'active', householdId: 'h', role: 'admin' })).toBe('/app');
    expect(routeFor({ kind: 'invited', householdId: 'h', invitationId: 'i' })).toBe(
      '/access/invited',
    );
    expect(routeFor({ kind: 'pending', requestId: 'r' })).toBe('/access/pending');
    expect(routeFor({ kind: 'suspended', householdId: 'h', role: 'member' })).toBe(
      '/access/blocked',
    );
    expect(routeFor({ kind: 'removed', householdId: 'h', role: 'member' })).toBe('/access/blocked');
    expect(routeFor({ kind: 'unassigned' })).toBe('/access/blocked');
  });
  it('leaves the blocked page when access becomes active', () => {
    expect(accessStatusRedirect({ kind: 'active', householdId: 'h', role: 'admin' })).toBe('/app');
    expect(accessStatusRedirect({ kind: 'unassigned' })).toBeNull();
  });
  it('maps provider errors to safe Korean messages', () => {
    expect(messageForError('Email not confirmed')).toContain('이메일 확인');
    expect(messageForError('rate limit exceeded')).toContain('잠시 후');
    expect(messageForError('Invalid login credentials')).not.toContain('Invalid');
  });
});
