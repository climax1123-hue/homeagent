import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createHouseholdApi, HouseholdApiError } from './household-api';

describe('household self-service API', () => {
  it('creates a household with trimmed names', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'household-1', error: null });
    const api = createHouseholdApi({ rpc } as unknown as SupabaseClient);

    await expect(api.createMyHousehold('  우리집  ', '  관리자  ')).resolves.toBe('household-1');
    expect(rpc).toHaveBeenCalledWith('create_my_household', {
      p_household_name: '우리집',
      p_display_name: '관리자',
    });
  });

  it('preserves the domain error for an existing household', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'ALREADY_HAS_HOUSEHOLD' },
    });
    const api = createHouseholdApi({ rpc } as unknown as SupabaseClient);

    await expect(api.createMyHousehold('우리집', '관리자')).rejects.toMatchObject({
      code: 'ALREADY_HAS_HOUSEHOLD',
    } satisfies Partial<HouseholdApiError>);
  });
});
