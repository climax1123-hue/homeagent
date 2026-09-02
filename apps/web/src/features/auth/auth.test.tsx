import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  AdminSignUpDisabledPage,
  accessStatusRedirect,
  isAccessResolutionPending,
  messageForError,
  normalizeEmail,
  routeFor,
} from './auth';

describe('auth utilities', () => {
  it('normalizes email identifiers', () =>
    expect(normalizeEmail(' Family@Example.COM ')).toBe('family@example.com'));
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
  it('keeps access loading while a newly signed-in user is unresolved', () => {
    expect(isAccessResolutionPending(false, 'new-user', null, false)).toBe(true);
    expect(isAccessResolutionPending(false, 'new-user', 'previous-user', false)).toBe(true);
    expect(isAccessResolutionPending(false, 'new-user', 'new-user', false)).toBe(false);
    expect(isAccessResolutionPending(false, null, null, false)).toBe(false);
  });
});

describe('administrator signup', () => {
  it('shows a closed notice without a signup form', () => {
    render(
      <MemoryRouter>
        <AdminSignUpDisabledPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '관리자 가입이 종료되었습니다' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '가입' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인으로' })).toHaveAttribute('href', '/login');
  });
});
