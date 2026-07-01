#!/usr/bin/env tsx
import { runMLBBacktestCLI } from '@/lib/backtesting/cli';

if (process.env.BACKTEST_LIVE_SMOKE !== '1') {
  process.stderr.write('Error: set BACKTEST_LIVE_SMOKE=1 before running the live backtest smoke test.\n');
  process.exit(1);
}

const dateEqualsArg = process.argv.find((arg) => arg.startsWith('--date='));
let date = '2024-06-01';

if (dateEqualsArg) {
  date = dateEqualsArg.slice('--date='.length);
} else {
  const dateIndex = process.argv.indexOf('--date');
  if (dateIndex >= 0) {
    const next = process.argv[dateIndex + 1];
    date = next ?? '2024-06-01';
  }
}

const forwarded: string[] = [];
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === '--date') {
    i += 1;
    continue;
  }
  if (arg.startsWith('--date=')) {
    continue;
  }
  if (arg === '--source' || arg === '--output') {
    i += 1;
    continue;
  }
  forwarded.push(arg);
}

;(async () => {
  process.exitCode = await runMLBBacktestCLI([
    '--source',
    'live',
    '--date',
    date,
    '--output',
    'text',
    ...forwarded,
  ]);
})();
