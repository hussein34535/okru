"use client";

import { useEffect, useState, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import Image from 'next/image';

function extractNameFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/');
    // Expected: /owner/repo/blob/branch/.github/workflows/file.yml
    if (parts.length > 6 && parts[parts.length - 2] === 'workflows') {
      return parts[parts.length - 1];
    }
    return 'Untitled';
  } catch {
    return 'Untitled';
  }
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('');
  const [repoName, setRepoName] = useState('');
  const [savedRepos, setSavedRepos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStopping, setIsStopping] = useState({});
  const [runsByUrl, setRunsByUrl] = useState({});
  const [elapsedTimes, setElapsedTimes] = useState({});
  const [editingRepo, setEditingRepo] = useState(null); // { id: string, name: string }

  const persistRuns = useCallback((runs) => {
    localStorage.setItem('runsByUrl', JSON.stringify(runs));
  }, []);

  useEffect(() => {
    // Atomically load and prune state from localStorage
    const savedReposRaw = localStorage.getItem('savedRepos');
    const runsByUrlRaw = localStorage.getItem('runsByUrl');

    const loadedRepos = savedReposRaw ? JSON.parse(savedReposRaw) : [];
    const loadedRuns = runsByUrlRaw ? JSON.parse(runsByUrlRaw) : {};

    // Backwards compatibility: convert string URLs to repo objects
    const migratedRepos = loadedRepos.map(repo => {
      if (typeof repo === 'string') {
        return { url: repo, name: extractNameFromUrl(repo), id: repo };
      }
      // Ensure all items have a unique ID
      if (!repo.id) {
        repo.id = repo.url;
      }
      return repo;
    });

    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const now = Date.now();
    const prunedRuns = Object.entries(loadedRuns).reduce((acc, [url, run]) => {
      if (run && run.startTime && (now - run.startTime < SIX_HOURS_MS)) {
        acc[url] = run;
      }
      return acc;
    }, {});

    setSavedRepos(migratedRepos);
    setRunsByUrl(prunedRuns);

    if (JSON.stringify(prunedRuns) !== JSON.stringify(loadedRuns)) {
      persistRuns(prunedRuns);
    }
  }, [persistRuns]);


  useEffect(() => {
    const interval = setInterval(() => {
      const nextElapsedTimes = {};
      const nextRuns = { ...runsByUrl };
      let shouldUpdateRuns = false;
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

      Object.entries(runsByUrl).forEach(([url, run]) => {
        if (run && run.startTime) {
          const elapsed = Date.now() - run.startTime;
          
          if (elapsed > SIX_HOURS_MS) {
            delete nextRuns[url];
            shouldUpdateRuns = true;
          } else {
            nextElapsedTimes[url] = formatElapsedTime(elapsed);
          }
        }
      });
      
      setElapsedTimes(nextElapsedTimes);

      if (shouldUpdateRuns) {
        setRunsByUrl(nextRuns);
        persistRuns(nextRuns);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [runsByUrl, persistRuns]);

  const formatElapsedTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const persistRepos = (list) => { 
    localStorage.setItem('savedRepos', JSON.stringify(list));
  };
  
  const saveCurrentRepo = () => {
    if (!repoUrl || !repoUrl.startsWith('https://github.com')) {
      toast.error('Please enter a valid GitHub workflow URL.');
      return;
    }
    if (savedRepos.some(r => r.url === repoUrl)) {
      toast.error('This repository URL is already saved.');
      return;
    }
    const nameToSave = repoName.trim() || extractNameFromUrl(repoUrl);
    const newRepo = { url: repoUrl, name: nameToSave, id: repoUrl };
    const updatedRepos = [...savedRepos, newRepo];
    setSavedRepos(updatedRepos);
    persistRepos(updatedRepos);
    setRepoUrl('');
    setRepoName('');
    toast.success('Repository saved!');
  };

  const removeRepo = (urlToRemove) => {
    const updatedRepos = savedRepos.filter(repo => repo.url !== urlToRemove);
    setSavedRepos(updatedRepos);
    persistRepos(updatedRepos);
    toast.success('Repository removed.');
  };

  const updateRepoName = (id, newName) => {
    if (!newName.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    const updatedRepos = savedRepos.map(repo => {
      if (repo.id === id) {
        return { ...repo, name: newName.trim() };
      }
      return repo;
    });
    setSavedRepos(updatedRepos);
    persistRepos(updatedRepos);
    setEditingRepo(null); // Exit editing mode
    toast.success("Name updated successfully!");
  };

  const exportData = () => {
    if (savedRepos.length === 0) {
      toast.error("No data to export.");
      return;
    }
    try {
      const jsonString = JSON.stringify(savedRepos, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'stream-control-backup.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded successfully!");
    } catch (error) {
      console.error('Export failed:', error);
      toast.error("Failed to export data.");
    }
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedRepos = JSON.parse(e.target.result);
        if (!Array.isArray(importedRepos)) {
          throw new Error("Invalid file format.");
        }

        // Filter out duplicates
        const existingUrls = new Set(savedRepos.map(repo => repo.url));
        const newRepos = importedRepos.filter(repo => repo.url && !existingUrls.has(repo.url));

        if (newRepos.length === 0) {
          toast.success("All repositories in the file are already saved.");
          return;
        }

        const updatedRepos = [...savedRepos, ...newRepos];
        setSavedRepos(updatedRepos);
        persistRepos(updatedRepos);
        toast.success(`${newRepos.length} new repositories imported successfully!`);

      } catch (error) {
        console.error('Import failed:', error);
        toast.error(`Import failed: ${error.message}`);
      } finally {
        // Reset file input to allow re-uploading the same file
        event.target.value = null;
      }
    };
    reader.readAsText(file);
  };

  const startWithUrl = async (url) => {
    setIsLoading(true);
    const promise = fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: url }),
    }).then(res => {
      if (!res.ok) throw new Error('Failed to start.');
      return res.json();
    });

    toast.promise(promise, {
      loading: 'Starting stream...',
      success: (data) => {
        const nextRuns = {
          ...runsByUrl,
          [url]: { startTime: Date.now(), runUrl: data.runUrl || '#' },
        };
        setRunsByUrl(nextRuns);
        persistRuns(nextRuns);
        return 'Stream started successfully!';
      },
      error: (err) => {
        return `Error: ${err.message}`;
      }
    });

    setIsLoading(false);
  };
  
  const stopWithUrl = async (url) => {
    setIsStopping(prev => ({ ...prev, [url]: true }));
    const promise = fetch('/api/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: url }),
    }).then(res => {
      if (!res.ok) throw new Error('Failed to stop.');
      return res.json();
    });

    toast.promise(promise, {
      loading: 'Stopping stream...',
      success: () => {
        const nextRuns = { ...runsByUrl };
        delete nextRuns[url];
        setRunsByUrl(nextRuns);
        persistRuns(nextRuns);
        return 'Stream stopped successfully!';
      },
      error: (err) => `Error: ${err.message}`,
    });
    
    setIsStopping(prev => ({ ...prev, [url]: false }));
  };

  const groupedRepos = savedRepos.reduce((acc, repo) => {
    try {
      const url = new URL(repo.url);
      const parts = url.pathname.split('/');
      if (parts.length >= 3) {
        const groupKey = `${parts[1]}/${parts[2]}`;
        if (!acc[groupKey]) {
          acc[groupKey] = [];
        }
        acc[groupKey].push(repo);
        return acc;
      }
    } catch { /* ignore invalid urls */ }
    if (!acc['Uncategorized']) acc['Uncategorized'] = [];
    acc['Uncategorized'].push(repo);
    return acc;
  }, {});


  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />
      <main>
        <div className="card">
          <h1 className="card-title">Stream Control</h1>
          <p className="card-subtitle">Manage your GitHub Actions workflow streams.</p>
          
          <div className="input-group mb-4">
             <input
              type="text"
              className="input"
              placeholder="Workflow Name (e.g., Bein Sports 1)"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
            />
            <input
              type="url"
              className="input"
              placeholder="Paste GitHub Workflow URL..."
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <button className="btn-primary" onClick={saveCurrentRepo} disabled={!repoUrl}>
              Save
            </button>
            <button onClick={exportData} className="btn-icon" title="Export Data">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3 12v1h10v-1H3zM8 11L13 6h-3V2H6v4H3l5 5z"/>
              </svg>
            </button>
            <label htmlFor="import-file" className="btn-icon cursor-pointer" title="Import Data">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3 12v1h10v-1H3zM8 2l-5 5h3v4h4V7h3l-5-5z"/>
              </svg>
              <input type="file" id="import-file" accept=".json" className="hidden" onChange={importData} />
            </label>
          </div>

          <div className="sections">
            {Object.entries(groupedRepos).map(([groupName, repos]) => (
              <div key={groupName} className="section">
                <div className="section-header">
                  <span className="repo-title">{groupName}</span>
                  <span className="count-badge">{repos.length}</span>
                </div>
                <div className="section-items">
                  {repos.map((repo) => {
                    const isRunning = !!runsByUrl[repo.url];
                    const runData = runsByUrl[repo.url];

                    return (
                      <div key={repo.id} className="saved-item">
                        <div className="item-url">
                          {editingRepo && editingRepo.id === repo.id ? (
                             <input
                              type="text"
                              value={editingRepo.name}
                              onChange={(e) => setEditingRepo({ ...editingRepo, name: e.target.value })}
                              className="input input-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') updateRepoName(repo.id, editingRepo.name);
                                if (e.key === 'Escape') setEditingRepo(null);
                              }}
                            />
                          ) : (
                            <span className="item-url-text font-semibold">{repo.name}</span>
                          )}

                          {isRunning ? (
                            <span className="chip chip-green">
                              Running for {elapsedTimes[repo.url] || '...'}
                            </span>
                          ) : (
                            <span className="chip chip-gray">Stopped</span>
                          )}
                        </div>
                        <div className="item-actions">
                          {editingRepo && editingRepo.id === repo.id ? (
                            <>
                              <button onClick={() => updateRepoName(repo.id, editingRepo.name)} className="btn-start btn-sm">Save</button>
                              <button onClick={() => setEditingRepo(null)} className="btn-icon btn-sm" title="Cancel">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              {isRunning ? (
                                <>
                                  <button 
                                    onClick={() => stopWithUrl(repo.url)} 
                                    className="btn-stop btn-sm"
                                    disabled={isStopping[repo.url]}
                                  >
                                    {isStopping[repo.url] ? 'Stopping...' : 'Stop'}
                                  </button>
                                  <a
                                    href={runData.runUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-icon btn-sm"
                                    title="View Logs on GitHub"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294l4-13zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z"/></svg>
                                  </a>
                                </>
                              ) : (
                                <button onClick={() => startWithUrl(repo.url)} className="btn-start btn-sm" disabled={isLoading}>
                                  Start
                                </button>
                              )}
                               <button onClick={() => setEditingRepo({ id: repo.id, name: repo.name })} className="btn-icon btn-sm" title="Edit Name">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
                                </svg>
                              </button>
                              <button onClick={() => removeRepo(repo.url)} className="btn-icon btn-sm" title="Remove">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <footer><p>تطبيق بسيط لتشغيل وإيقاف GitHub Actions.</p></footer>
      </main>
    </>
  );
}