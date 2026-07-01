import { NextResponse } from 'next/server';
import { getDashboardStats, getRecentMultis, settleMulti } from './actions';

export async function GET() {
  const stats = await getDashboardStats();
  return NextResponse.json(stats);
}

export async function POST(request: Request) {
  const body = await request.json();
  // Phase 0: stub route
  return NextResponse.json({ received: true, body });
}
