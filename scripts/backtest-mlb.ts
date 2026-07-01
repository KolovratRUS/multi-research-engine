#!/usr/bin/env tsx
import { runMLBBacktestCLI } from '@/lib/backtesting/cli';

(async () => {
  process.exitCode = await runMLBBacktestCLI(process.argv.slice(2));
})();
