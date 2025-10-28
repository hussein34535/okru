import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { dispatchWorkflow } from '@/lib/github';

export const dynamic = 'force-dynamic';

const SCHEDULE_KEY = 'github-dispatch-schedule';

// This function will be triggered by a Vercel Cron Job
export async function GET() {
  try {
    const now = new Date();
    // Format current time to "HH:mm" in UTC
    const currentTimeUTC = now.toISOString().substr(11, 5);

    // Get all scheduled times from the sorted set
    const scheduledTimes = await kv.zrange(SCHEDULE_KEY, 0, -1);

    if (!scheduledTimes || scheduledTimes.length === 0) {
      return NextResponse.json({ message: 'No scheduled jobs to run.' });
    }

    let dispatchedCount = 0;
    const errors = [];

    for (const time of scheduledTimes) {
      if (time === currentTimeUTC) {
        try {
          console.log(`Dispatching workflow for scheduled time: ${time}`);
          await dispatchWorkflow();
          
          // On success, remove the job from the KV store
          await kv.zrem(SCHEDULE_KEY, time);
          dispatchedCount++;
        } catch (error) {
          console.error(`Failed to dispatch scheduled workflow for ${time}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown dispatch error';
          errors.push({ time, error: errorMessage });
        }
      }
    }

    if (dispatchedCount > 0) {
      return NextResponse.json({ message: `Successfully dispatched ${dispatchedCount} workflow(s).`, errors });
    } else {
      return NextResponse.json({ message: 'No jobs scheduled for the current time.', errors });
    }

  } catch (error) {
    console.error('Error in cron handler:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Cron handler failed.', error: errorMessage }, { status: 500 });
  }
}
