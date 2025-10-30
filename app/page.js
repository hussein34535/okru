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
  const [startDelayMin, setStartDelayMin] = useState('');
  const [autoStopMin, setAutoStopMin] = useState('');
  const [countdownSec, setCountdownSec] = useState(0);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [scheduleTimer, setScheduleTimer] = useState(null);
  const [stopTimer, setStopTimer] = useState(null);
  const [countdownTimer, setCountdownTimer] = useState(null);
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

  const scheduleStart = () => {
    const delay = parseInt(startDelayMin, 10);
    if (!Number.isFinite(delay) || delay <= 0) { toast.error('أدخل تأخير بالدقائق (> 0)'); return; }
    if (isCountdownActive) { toast('هناك مؤقت قيد العمل'); return; }
    const urlToRun = repoUrl.trim();
    if (!urlToRun) { toast.error('حدد رابطًا للتشغيل المؤقت'); return; }

    const totalSec = delay * 60; setCountdownSec(totalSec); setIsCountdownActive(true);
    const ct = setInterval(() => { setCountdownSec((s) => { if (s <= 1) { clearInterval(ct); return 0; } return s - 1; }); }, 1000); setCountdownTimer(ct);
    
    const st = setTimeout(async () => {
      setIsCountdownActive(false);
      await startWithUrl(urlToRun);
      const stopM = parseInt(autoStopMin, 10);
      if (Number.isFinite(stopM) && stopM > 0) {
        const t = setTimeout(async () => { await stopWithUrl(urlToRun); }, stopM * 60 * 1000);
        setStopTimer(t); toast('سَيتم الإيقاف التلقائي بعد انتهاء المدة');
      }
    }, totalSec * 1000);
    setScheduleTimer(st); toast.success('تم تعيين مؤقت للتشغيل');
  };

  const cancelScheduled = () => {
    if (scheduleTimer) clearTimeout(scheduleTimer);
    if (countdownTimer) clearInterval(countdownTimer);
    setScheduleTimer(null); setCountdownTimer(null); setIsCountdownActive(false); setCountdownSec(0); toast('تم إلغاء المؤقت');
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

          <div className="input-group" style={{ marginBottom: '0.75rem' }}>
            <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="رابط ملف workflow على GitHub" className="input" dir="ltr" />
            <div style={{ height: '0.5rem' }} />
            <div className="inputs-row">
              <input type="number" min="1" className="input number" placeholder="تأخير بالدقائق" value={startDelayMin} onChange={(e) => setStartDelayMin(e.target.value)} />
              <input type="number" min="1" className="input number" placeholder="مدة التشغيل بالدقائق" value={autoStopMin} onChange={(e) => setAutoStopMin(e.target.value)} />
              {!isCountdownActive ? (<button onClick={scheduleStart} className="btn-secondary">تشغيل مؤقت</button>) : (<button onClick={cancelScheduled} className="btn-stop">إلغاء المؤقت</button>)}
            </div>
            {isCountdownActive && (<div className="countdown">سيبدأ خلال: {Math.floor(countdownSec / 60)}:{String(countdownSec % 60).padStart(2, '0')}</div>)}
            <div style={{ height: '0.5rem' }} />
            <button onClick={saveCurrentRepo} className="btn-secondary" disabled={!repoUrl.trim()}>حفظ الرابط</button>
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
                            {meta ? (<><span>{meta.file}</span><span className="chip" style={{ marginInlineStart: '0.5rem' }}>{meta.ref}</span></>) : (<span>{url}</span>)}
                            <span className={`chip ${isRun ? 'chip-green' : 'chip-gray'}`} style={{ marginInlineStart: '0.5rem' }}>{isRun ? 'شغال' : 'متوقف'}</span>
                            {isRun && <span className="chip" style={{ marginInlineStart: '0.5rem' }}>{formatElapsed(elapsed)}</span>}
                          </div>
                          <div className="item-actions">
                            <button className="btn-secondary btn-sm" disabled={isDispatching || isStopping} onClick={() => startWithUrl(url)}>تشغيل</button>
                            <button className="btn-stop btn-sm" disabled={isStopping || isDispatching} onClick={() => stopWithUrl(url)}>إيقاف</button>
                            <button className="btn-icon" onClick={() => { setRepoUrl(url); toast('تم إدراج الرابط في الحقل'); }}>استخدام</button>
                            <button className="btn-icon" onClick={() => removeRepo(url)}>حذف</button>
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