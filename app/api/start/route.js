import { NextResponse } from 'next/server';
import { dispatchWorkflow } from '../../../lib/github';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    let overrides = {};
    try {
      overrides = await request.json();
    } catch {
      overrides = {};
    }

    await dispatchWorkflow(overrides);
    return NextResponse.json({ message: 'Workflow dispatch request sent successfully.' });
  } catch (error) {
    console.error('Error in start API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Failed to dispatch workflow.', error: errorMessage }, { status: 500 });
  }
}
