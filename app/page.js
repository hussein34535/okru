"use client";

import { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';

export default function Home() {
  const [isDispatching, setIsDispatching] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const handleDispatchNow = async () => {
    setIsDispatching(true);
    const promise = fetch('/api/start', { method: 'POST' });
    toast.promise(promise, {
      loading: 'جاري بدء البث...',
      success: 'تم إرسال طلب بدء البث بنجاح!',
      error: 'فشل الطلب. تحقق من الإعدادات والمتغيرات.',
    }).finally(() => setIsDispatching(false));
  };

  const handleStop = async () => {
    setIsStopping(true);
    const promise = fetch('/api/stop', { method: 'POST' });
    toast.promise(promise, {
      loading: 'جاري إرسال طلب الإيقاف...',
      success: (res) => {
        if (!res.ok) {
          throw new Error('لم يتم العثور على بث لإيقافه.');
        }
        return 'تم إرسال طلب الإيقاف بنجاح!';
      },
      error: (err) => `حدث خطأ: ${err.message}`,
    }).finally(() => setIsStopping(false));
  };

  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          className: 'bg-gray-800 text-white',
          duration: 4000,
        }}
      />
      <main>
        <div className="card">
          <div style={{ textAlign: 'center' }}>
            <h1 className="card-title">تحكم في بث GitHub</h1>
            <p className="card-subtitle">ابدأ أو أوقف بث GitHub Actions.</p>
          </div>

          <div className="button-group">
            <button
              onClick={handleDispatchNow}
              disabled={isDispatching || isStopping}
              className="btn-start"
            >
              {isDispatching ? 'جاري البدء...' : 'ابدأ البث الآن'}
            </button>
            
            <button
              onClick={handleStop}
              disabled={isStopping || isDispatching}
              className="btn-stop"
            >
              {isStopping ? 'جاري الإيقاف...' : 'إيقاف آخر بث'}
            </button>
          </div>
        </div>
        <footer>
          <p>
            تطبيق بسيط لتشغيل وإيقاف GitHub Actions.
          </p>
        </footer>
      </main>
    </>
  );
}
