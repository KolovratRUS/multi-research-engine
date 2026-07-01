import { db } from './db';
import type { MultiStatus } from '@prisma/client';

export interface DashboardStats {
  databaseAvailable: boolean;
  eventCount: number;
  candidateCount: number;
  lastRefreshAt: Date | null;
  lastRefreshProvider: string | null;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const eventCount = await db.event.count();
    const candidateCount = await db.researchCandidate.count();
    const lastRefresh = await db.refresh.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    return {
      databaseAvailable: true,
      eventCount,
      candidateCount,
      lastRefreshAt: lastRefresh?.createdAt ?? null,
      lastRefreshProvider: lastRefresh?.provider ?? null,
    };
  } catch (error) {
    console.error('[server/actions] Database unavailable:', error);
    return {
      databaseAvailable: false,
      eventCount: 0,
      candidateCount: 0,
      lastRefreshAt: null,
      lastRefreshProvider: null,
    };
  }
}

export async function getRecentMultis(limit = 10) {
  try {
    return db.multi.findMany({
      take: limit,
      orderBy: { generatedAt: 'desc' },
      include: { legs: true },
    });
  } catch (error) {
    console.error('[server/actions] Database unavailable:', error);
    return [];
  }
}

export async function settleMulti(multiId: string, status: MultiStatus, profitLoss?: number) {
  try {
    return db.multi.update({
      where: { id: multiId },
      data: {
        status,
        settledAt: status === 'SETTLED' ? new Date() : undefined,
        profitLoss,
      },
    });
  } catch (error) {
    console.error('[server/actions] Database unavailable:', error);
    return null;
  }
}
