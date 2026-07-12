import { describe, it, expect, beforeEach } from 'vitest';
import { buildMLBFixtureInventory, type MLBFixtureInventory } from '../../scripts/mlb-fixture-inventory';

describe('Phase 3C MLB backtest: fixture inventory reporting polish', () => {
  let inventory: MLBFixtureInventory;

  beforeEach(() => {
    inventory = buildMLBFixtureInventory();
  });

  it('preserves existing baseline fields', () => {
    expect(inventory.startDate).toBe('2024-06-01');
    expect(inventory.endDate).toBe('2024-07-21');
    expect(inventory.totalGames).toBe(29);
    expect(inventory.gamesByMonth).toEqual({ '2024-06': 17, '2024-07': 12 });
    expect(inventory.uniqueDateCount).toBe(27);
    expect(inventory.juneGameCount).toBe(17);
    expect(inventory.julyGameCount).toBe(12);
    expect(inventory.julyDates).toEqual([
      '2024-07-01',
      '2024-07-03',
      '2024-07-05',
      '2024-07-07',
      '2024-07-08',
      '2024-07-10',
      '2024-07-12',
      '2024-07-14',
      '2024-07-15',
      '2024-07-17',
      '2024-07-19',
      '2024-07-21',
    ]);
  });

  it('reports month summaries sorted and populated', () => {
    expect(inventory.monthSummaries).toHaveLength(2);
    expect(inventory.monthSummaries[0].month).toBe('2024-06');
    expect(inventory.monthSummaries[1].month).toBe('2024-07');
    expect(inventory.monthSummaries[0].gameCount).toBe(17);
    expect(inventory.monthSummaries[0].uniqueDateCount).toBe(15);
    expect(inventory.monthSummaries[1].gameCount).toBe(12);
    expect(inventory.monthSummaries[1].uniqueDateCount).toBe(12);
  });

  it('reports date summaries sorted and includes 2024-07-21', () => {
    expect(inventory.dateSummaries[0].date).toBe('2024-06-01');
    const last = inventory.dateSummaries[inventory.dateSummaries.length - 1];
    expect(last.date).toBe('2024-07-21');
    expect(last.gameCount).toBe(1);
  });

  it('reports local july slice summaries', () => {
    expect(inventory.localSliceSummaries).toHaveLength(3);
    expect(inventory.localSliceSummaries.map((slice) => slice.label)).toEqual([
      'july-slice01',
      'july-slice02',
      'july-slice03',
    ]);
    for (const slice of inventory.localSliceSummaries) {
      expect(slice.gameCount).toBe(4);
      expect(slice.dates).toHaveLength(4);
    }
    expect(inventory.localSliceSummaries[0].dates).toEqual([
      '2024-07-01',
      '2024-07-03',
      '2024-07-05',
      '2024-07-07',
    ]);
    expect(inventory.localSliceSummaries[1].dates).toEqual([
      '2024-07-08',
      '2024-07-10',
      '2024-07-12',
      '2024-07-14',
    ]);
    expect(inventory.localSliceSummaries[2].dates).toEqual([
      '2024-07-15',
      '2024-07-17',
      '2024-07-19',
      '2024-07-21',
    ]);
  });

  it('does not mutate fixture data across calls', () => {
    const before = inventory.totalGames;
    const snapshot = buildMLBFixtureInventory();
    expect(snapshot.totalGames).toBe(before);
    expect(snapshot.julyDates).toEqual(inventory.julyDates);
  });
});
