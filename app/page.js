"use client";

import { useEffect, useState, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';

function parseWorkflowUrl(repoUrl) {
  try {
    const url = new URL(repoUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 5) return null;
    const owner = parts[0];
    const repo = parts[1];
    const ref = parts[3];
    const file = parts[parts.length - 1];
    return { owner, repo, ref, file };
  } catch {
    return null;
  }
}

export default function Home() {
  const [isDispatching, setIsDispatching] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [savedRepos, setSavedRepos] = useState([]);
  const [runsByUrl, setRunsByUrl] = useState({});
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    try {
      const rawRepos = localStorage.getItem('savedRepos');
      const rawRuns = localStorage.getItem('runsByUrl');
      const saved = rawRepos ? JSON.parse(rawRepos) : [];
      const runs = rawRuns ? JSON.parse(rawRuns) : {};
      
      const prunedRuns = {};
      if (Array.isArray(saved) && runs && typeof runs === 'object') {
        for (const url of saved) {
          if (runs[url]) {
            prunedRuns[url] = runs[url];
          }
        }
      }
      
      setSavedRepos(Array.isArray(saved) ? saved : []);
      setRunsByUrl(prunedRuns);
    } catch (e) {
      console.error("Failed to load from localStorage", e);
      setSavedRepos([]);
      setRunsByUrl({});
    }
  }, []);

  const persistRuns = useCallback((newRuns) => {
    try {
      localStorage.setItem('runsByUrl', JSON.stringify(newRuns));
    } catch (e) {
      console.error("Failed to save runs to localStorage", e);
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const persistRepos = (list) => { 
    setSavedRepos(list); 
    try { localStorage.setItem('savedRepos', JSON.stringify(list)); } catch {} 
  };

  const saveCurrentRepo = () => {
    const url = repoUrl.trim();
    if (!url) { toast.error('أدخل رابطًا أولًا'); return; }
    if (savedRepos.includes(url)) { toast('الرابط محفوظ مسبقًا'); return; }
    const next = [url, ...savedRepos].slice(0, 50); 
    persistRepos(next); 
    toast.success('تم حفظ الرابط');
  };

  const removeRepo = (url) => {
    const nextRepos = savedRepos.filter((u) => u !== url);
    persistRepos(nextRepos);
    setRunsByUrl((currentRuns) => {
      const nextRuns = { ...currentRuns };
      delete nextRuns[url];
      persistRuns(nextRuns);
      return nextRuns;
    });
    toast.success('تم حذف الرابط');
  };

  const startWithUrl = async (url) => {
    setIsDispatching(true);
    const pressedAt = Date.now();
    
    setRunsByUrl(currentRuns => {
      const next = { ...currentRuns, [url]: { isRunning: true, startedAt: pressedAt } };
      persistRuns(next);
      return next;
    });

    const promise = fetch('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repoUrl: url }) });
    
    toast.promise(promise, {
      loading: 'جاري بدء البث...',
      success: 'تم إرسال طلب بدء البث بنجاح!',
      error: 'فشل الطلب. تحقق من الإعدادات والمتغيرات.'
    });

    try {
      const res = await promise;
      if (!res.ok) throw new Error("Server responded with an error");
    } catch (e) {
      setRunsByUrl(currentRuns => {
        const next = { ...currentRuns, [url]: { isRunning: false, startedAt: null } };
        persistRuns(next);
        return next;
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const stopWithUrl = async (url) => {
    setIsStopping(true);
    const prev = runsByUrl[url] || { isRunning: false, startedAt: null };

    setRunsByUrl(currentRuns => {
      const next = { ...currentRuns, [url]: { isRunning: false, startedAt: null } };
      persistRuns(next);
      return next;
    });

    const promise = fetch('/api/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repoUrl: url }) });

    toast.promise(promise, {
      loading: 'جاري إرسال طلب الإيقاف...',
      success: 'تم إرسال طلب الإيقاف بنجاح!',
      error: 'لم يتم العثور على بث لإيقافه.'
    });

    try {
      const res = await promise;
      if (!res.ok) throw new Error("Server responded with an error");
    } catch (e) {
      setRunsByUrl(currentRuns => {
        const next = { ...currentRuns, [url]: prev };
        persistRuns(next);
        return next;
      });
    } finally {
      setIsStopping(false);
    }
  };

  

  const grouped = savedRepos.reduce((acc, url) => { const meta = parseWorkflowUrl(url); const key = meta ? `${meta.owner}/${meta.repo}` : 'روابط غير معروفة'; if (!acc[key]) acc[key] = []; acc[key].push({ url, meta }); return acc; }, {});

  const formatElapsed = (s) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60; return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`; };

  return (
    <>
      <Toaster position="top-center" toastOptions={{ className: 'bg-gray-800 text-white', duration: 4000 }} />
      <main>
        <div className="card">
          <div style={{ textAlign: 'center' }}>
            <h1 className="card-title">تحكم في بث GitHub</h1>
            <p className="card-subtitle">ابدأ أو أوقف بث GitHub Actions.</p>
          </div>

          <div className="input-group">
            <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="رابط ملف workflow على GitHub" className="input" dir="ltr" />
            <button onClick={saveCurrentRepo} className="btn-primary" disabled={!repoUrl.trim()}>حفظ الرابط</button>
          </div>

          {Object.keys(grouped).length > 0 && (
            <div className="sections">
              {Object.entries(grouped).map(([repoKey, items]) => (
                <div className="section" key={repoKey}>
                  <div className="section-header">
                    <div className="repo-title">{repoKey}</div>
                    <div className="count-badge">{items.length}</div>
                  </div>
                  <div className="section-items">
                    {items.map(({ url, meta }) => {
                      const run = runsByUrl[url];
                      const isRun = !!run?.isRunning;
                      const elapsed = run?.startedAt ? Math.max(0, Math.floor((nowTs - run.startedAt) / 1000)) : 0;
                      return (
                        <div className="saved-item" key={url}>
                          <div className="item-url" title={url}>
                            <span className="item-url-text">
                             {meta ? `${meta.file} (${meta.ref})` : url}
                            </span>
                             <span className={`chip ${isRun ? 'chip-green' : 'chip-gray'}`}>{isRun ? 'شغال' : 'متوقف'}</span>
                             {isRun && <span className="chip chip-gray">{formatElapsed(elapsed)}</span>}
                           </div>
                           <div className="item-actions">
                             <button className="btn-start btn-sm" disabled={isDispatching || isStopping} onClick={() => startWithUrl(url)}>تشغيل</button>
                             <button className="btn-stop btn-sm" disabled={isStopping || isDispatching} onClick={() => stopWithUrl(url)}>إيقاف</button>
                             <button className="btn-icon" onClick={() => { setRepoUrl(url); toast('تم إدراج الرابط في الحقل'); }} title="استخدام الرابط">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>
                             </button>
                             <button className="btn-icon" onClick={() => removeRepo(url)} title="حذف الرابط">
                               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                             </button>
                           </div>
                         </div>
                       );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <footer><p>تطبيق بسيط لتشغيل وإيقاف GitHub Actions.</p></footer>
      </main>
    </>
  );
}