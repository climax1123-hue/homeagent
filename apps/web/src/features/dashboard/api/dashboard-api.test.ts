import { describe, expect, it, vi } from 'vitest';
import { createDashboardApi } from './dashboard-api';

describe('dashboard api', () => {
  it('falls back to the complete default order for invalid stored data', async () => {
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { widget_order: ['schedule'] }, error: null });
    const client = {
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) }),
    };
    const result = await createDashboardApi(client as never).getOrder('home', 'user');
    expect(result).toEqual(['schedule', 'ledger', 'ddays', 'goals', 'quick_actions']);
  });
  it('rejects incomplete orders before writing', async () => {
    const client = { from: vi.fn() };
    await expect(
      createDashboardApi(client as never).saveOrder('home', 'user', ['schedule'] as never),
    ).rejects.toThrow('올바르지 않습니다');
    expect(client.from).not.toHaveBeenCalled();
  });
});
