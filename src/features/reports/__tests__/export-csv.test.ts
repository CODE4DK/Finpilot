import * as Sharing from 'expo-sharing';

import { exportPeriodCsv } from '@/features/reports/export-csv';
import { createMockDatabase } from '@/test-utils/mock-database';

const USER = 'a1111111-1111-4111-8111-111111111111';
const PERIOD = {
  from: new Date(2026, 8, 1).toISOString(),
  to: new Date(2026, 9, 1).toISOString(),
};

const ROW = {
  occurred_at: new Date(2026, 8, 2, 12, 0).toISOString(),
  type: 'expense',
  amount_paise: 123450,
  category_name: 'Food',
  account_name: 'HDFC',
  to_account_name: null,
  note: 'Lunch',
};

describe('exportPeriodCsv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  });

  it('writes the period file and opens the share sheet', async () => {
    const db = createMockDatabase();
    db.queueRows([ROW]);

    const result = await exportPeriodCsv(db, USER, PERIOD);

    expect(result).toEqual({
      status: 'shared',
      uri: 'file:///cache/finpilot-2026-09-01-to-2026-09-30.csv',
      rowCount: 1,
    });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      'file:///cache/finpilot-2026-09-01-to-2026-09-30.csv',
      expect.objectContaining({ mimeType: 'text/csv' }),
    );
  });

  it('says there is nothing to export rather than sharing an empty file', async () => {
    const db = createMockDatabase();
    db.queueRows([]);

    const result = await exportPeriodCsv(db, USER, PERIOD);

    expect(result).toEqual({ status: 'empty' });
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('still writes the file when the device cannot share', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    const db = createMockDatabase();
    db.queueRows([ROW]);

    const result = await exportPeriodCsv(db, USER, PERIOD);

    expect(result.status).toBe('unavailable');
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('reads only this user, and only the period', async () => {
    const db = createMockDatabase();
    db.queueRows([ROW]);

    await exportPeriodCsv(db, USER, PERIOD);

    expect(db.lastCall()!.parameters).toEqual([USER, PERIOD.from, PERIOD.to]);
  });
});
