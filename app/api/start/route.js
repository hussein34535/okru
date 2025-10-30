import { NextResponse } from 'next/server';
import { dispatchWorkflow, getLatestInProgressRun } from '../../../lib/github';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const overrides = await request.json();

    await dispatchWorkflow(overrides);

    // After dispatching, try to find the run that was just created.
    // The getLatestInProgressRun function has built-in retries to wait for the run to appear.
    const run = await getLatestInProgressRun(overrides);

    if (run) {
      return NextResponse.json({
        message: 'Workflow dispatched and found.',
        runUrl: run.html_url, // Send the URL for the logs back to the client
      });
    }

    return NextResponse.json({
      message: 'Workflow dispatch request sent, but could not confirm new run.',
    });
  } catch (error) {
    console.error('Error in start API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Failed to dispatch workflow.', error: errorMessage }, { status: 500 });
  }
}
