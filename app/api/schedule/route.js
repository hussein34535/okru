import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';

// We'll use a simple key for this example. 
// In a multi-user app, you'd want a unique key per user.
const SCHEDULE_KEY = 'github-dispatch-schedule';

export async function POST(request) {
  try {
    const { time } = await request.json(); // Expect time in "HH:mm" format

    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ message: 'Invalid time format. Please use HH:mm.' }, { status: 400 });
    }

    // Vercel Cron Jobs and servers run in UTC. 
    // We store the user's desired "HH:mm" time directly.
    // The cron job will check every minute if the current UTC time matches any scheduled time.
    
    // Using a sorted set to store multiple schedules
    // The score can be used for ordering, here we'll use timestamp of creation
    const score = Date.now();
    await kv.zadd(SCHEDULE_KEY, { score, member: time });

    return NextResponse.json({ message: `Workflow scheduled for ${time} UTC daily.` });

  } catch (error) {
    console.error('Error scheduling workflow:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Failed to schedule workflow.', error: errorMessage }, { status: 500 });
  }
}
