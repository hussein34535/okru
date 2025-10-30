function parseWorkflowUrl(repoUrl) {
  if (!repoUrl || typeof repoUrl !== 'string') return null;
  try {
    const url = new URL(repoUrl);
    // Expected: https://github.com/{owner}/{repo}/blob/{ref}/.github/workflows/{file}
    const parts = url.pathname.split('/').filter(Boolean);
    // parts: [owner, repo, 'blob'|'tree', ref, ...path]
    if (parts.length < 5) return null;
    const owner = parts[0];
    const repo = parts[1];
    const blobOrTree = parts[2];
    const ref = parts[3];
    const pathParts = parts.slice(4);
    const fileName = pathParts[pathParts.length - 1];
    if ((blobOrTree !== 'blob' && blobOrTree !== 'tree') || !fileName.endsWith('.yml')) {
      return { owner, repo, ref, workflowId: fileName }; // best effort
    }
    return { owner, repo, ref, workflowId: fileName };
  } catch {
    return null;
  }
}

function resolveRepoParams(overrides) {
  const parsed = overrides?.repoUrl ? parseWorkflowUrl(overrides.repoUrl) : null;
  const owner = overrides?.owner || parsed?.owner || process.env.GITHUB_REPO_OWNER;
  const repo = overrides?.repo || parsed?.repo || process.env.GITHUB_REPO_NAME;
  const workflowId = overrides?.workflowId || parsed?.workflowId || process.env.GITHUB_WORKFLOW_ID || 'blank.yml';
  const ref = overrides?.ref || parsed?.ref || 'main';
  return { owner, repo, workflowId, ref };
}

export async function dispatchWorkflow(overrides) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const { owner, repo, workflowId, ref } = resolveRepoParams(overrides);

  if (!GITHUB_TOKEN || !owner || !repo) {
    throw new Error('Missing required GitHub environment variables.');
  }

  const dispatchUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;

  const response = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref }),
  });

  if (!response.ok) {
    let errorData;
    try { errorData = await response.json(); } catch { errorData = {}; }
    console.error('GitHub API Error:', errorData);
    throw new Error(`Failed to dispatch workflow: ${errorData?.message || response.statusText}`);
  }

  return { success: true, status: response.status };
}

export async function getLatestInProgressRun(overrides) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const { owner, repo } = resolveRepoParams(overrides);

  if (!GITHUB_TOKEN || !owner || !repo) {
    throw new Error('Missing required GitHub environment variables.');
  }

  const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=30`;
  const activeStatuses = new Set(['in_progress', 'queued', 'waiting', 'pending', 'requested']);

  async function fetchRunsOnce() {
    const response = await fetch(runsUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); } catch { errorData = {}; }
      throw new Error(`Failed to get workflow runs: ${errorData?.message || response.statusText}`);
    }

    const data = await response.json();
    if (data.workflow_runs && data.workflow_runs.length > 0) {
      const found = data.workflow_runs.find((run) => activeStatuses.has(run.status));
      if (found) return found;
    }
    return null;
  }

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const run = await fetchRunsOnce();
    if (run) return run;
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 800));
  }

  return null;
}

export async function cancelWorkflowRun(runId, overrides) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const { owner, repo } = resolveRepoParams(overrides);

  if (!GITHUB_TOKEN || !owner || !repo) {
    throw new Error('Missing required GitHub environment variables.');
  }

  const cancelUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/cancel`;

  const response = await fetch(cancelUrl, {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    let errorData;
    try { errorData = await response.json(); } catch { errorData = {}; }
    throw new Error(`Failed to cancel workflow run: ${errorData?.message || response.statusText}`);
  }

  return { success: true, status: response.status };
}

export async function getLatestRun(overrides) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const { owner, repo } = resolveRepoParams(overrides);

  if (!GITHUB_TOKEN || !owner || !repo) {
    throw new Error('Missing required GitHub environment variables.');
  }

  const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`;
  const response = await fetch(runsUrl, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    let errorData;
    try { errorData = await response.json(); } catch { errorData = {}; }
    throw new Error(`Failed to get workflow runs: ${errorData?.message || response.statusText}`);
  }

  const data = await response.json();
  const run = data.workflow_runs?.[0];
  if (!run) return null;
  return {
    id: run.id,
    runNumber: run.run_number,
    status: run.status, // queued | in_progress | completed | etc.
    conclusion: run.conclusion, // success | failure | cancelled | null if not completed
    htmlUrl: run.html_url,
    name: run.name,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  };
}

export { parseWorkflowUrl };