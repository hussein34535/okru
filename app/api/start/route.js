import { NextResponse } from 'next/server';
import { dispatchWorkflow } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await dispatchWorkflow();
    return NextResponse.json({ message: 'Workflow dispatch request sent successfully.' });
  } catch (error) {
    console.error('Error in start API:', error);
    // Ensure error is a proper Error object to get a message
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Failed to dispatch workflow.', error: errorMessage }, { status: 500 });
  }
}
