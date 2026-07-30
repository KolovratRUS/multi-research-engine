export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getDashboardStats, getRecentMultis } from '@/server/actions';
import type { DashboardStats } from '@/server/actions';

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const multis = (await getRecentMultis()) as Array<{
    id: string;
    targetTier: number;
    status: string;
    combinedOdds: unknown;
    legs: unknown[];
  }>;

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Multi Research Engine — Dashboard</h1>

      <p className="text-sm text-gray-600">
        <Link href="/mlb/report-preview">MLB Report Preview</Link>
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Research Status</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Database</dt>
            <dd className="text-xl font-medium">
              {(stats as DashboardStats).databaseAvailable ? 'Connected' : 'Unavailable'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Events analysed</dt>
            <dd className="text-xl font-medium">{stats.eventCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Candidate legs</dt>
            <dd className="text-xl font-medium">{stats.candidateCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Last data refresh</dt>
            <dd className="text-xl font-medium">
              {stats.lastRefreshAt ? new Date(stats.lastRefreshAt).toLocaleString() : 'Never'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Provider</dt>
            <dd className="text-xl font-medium">{stats.lastRefreshProvider ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Recent Multis</h2>
        {multis.length === 0 ? (
          <p className="text-gray-500">No multis generated yet.</p>
        ) : (
          <ul className="space-y-2">
            {multis.map((m) => (
              <li key={m.id} className="border rounded p-3">
                <div className="flex justify-between">
                  <span className="font-medium">{m.targetTier} researched multi</span>
                  <span className="text-sm text-gray-500">{m.status}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Combined odds: {Number(m.combinedOdds).toFixed(2)} &middot; Legs: {(m.legs as unknown[]).length}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-gray-500">
        Phase 0 demonstration — mock fixtures only. Not validated against historical outcomes.
      </p>
    </main>
  );
}
