import { NextResponse } from 'next/server';
import { getLatestInProgressRun, cancelWorkflowRun } from '../../../lib/github';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const latestRun = await getLatestInProgressRun();

    if (!latestRun) {
      return NextResponse.json({ message: 'No workflow run is currently in progress or queued.' }, { status: 404 });
    }

    await cancelWorkflowRun(latestRun.id);

    return NextResponse.json({ message: `Successfully requested cancellation for workflow run #${latestRun.run_number}.` });

  } catch (error) {
    console.error('Error in stop API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Failed to cancel workflow run.', error: errorMessage }, { status: 500 });
  }
}
