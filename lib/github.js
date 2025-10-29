export async function dispatchWorkflow() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = process.env.GITHUB_REPO_OWNER;
  const REPO_NAME = process.env.GITHUB_REPO_NAME;
  const WORKFLOW_ID = process.env.GITHUB_WORKFLOW_ID || 'blank.yml';

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    throw new Error('Missing required GitHub environment variables.');
  }

  const dispatchUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/dispatches`;

  const response = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref: 'main' }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('GitHub API Error:', errorData);
    throw new Error(`Failed to dispatch workflow: ${errorData.message || response.statusText}`);
  }

  // response.ok with status 204 (No Content) is a success
  return { success: true, status: response.status };
}

export async function getLatestInProgressRun() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = process.env.GITHUB_REPO_OWNER;
  const REPO_NAME = process.env.GITHUB_REPO_NAME;
  const WORKFLOW_ID = process.env.GITHUB_WORKFLOW_ID || 'blank.yml';

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    throw new Error('Missing required GitHub environment variables.');
  }

  const runsUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/runs?status=in_progress,queued`;

  const response = await fetch(runsUrl, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to get workflow runs: ${errorData.message || response.statusText}`);
  }

  const data = await response.json();
  if (data.workflow_runs && data.workflow_runs.length > 0) {
    // The API returns runs sorted by creation time, latest first.
    return data.workflow_runs[0];
  }

  return null; // No runs in progress
}

export async function cancelWorkflowRun(runId) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = process.env.GITHUB_REPO_OWNER;
  const REPO_NAME = process.env.GITHUB_REPO_NAME;

  if (!GITHUB_TOKEN || !REPO_OWNER || !REPO_NAME) {
    throw new Error('Missing required GitHub environment variables.');
  }

  const cancelUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}/cancel`;

  const response = await fetch(cancelUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to cancel workflow run: ${errorData.message || response.statusText}`);
  }

  return { success: true, status: response.status };
}