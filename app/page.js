"use client";

import { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';

export default function Home() {
  const [scheduledTime, setScheduledTime] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  // Function to handle the immediate dispatch
  const handleDispatchNow = async () => {
    setIsDispatching(true);
    
    const promise = fetch('/api/start', { method: 'POST' });

    toast.promise(promise, {
      loading: 'جاري بدء البث...',
      success: (res) => {
        if (!res.ok) {
          // Throw an error to be caught by the error handler
          throw new Error('فشل الطلب. تحقق من الإعدادات.');
        }
        return 'تم إرسال طلب بدء البث بنجاح!';
      },
      error: (err) => `حدث خطأ: ${err.message}`,
    }).finally(() => {
      setIsDispatching(false);
    });
  };

  // Function to handle the scheduled dispatch
  const handleSchedule = async () => {
    if (!scheduledTime) {
      toast.error('الرجاء تحديد وقت للجدولة أولاً.');
      return;
    }
    setIsScheduling(true);

    const promise = fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time: scheduledTime }),
    });

    toast.promise(promise, {
      loading: 'جاري جدولة البث...',
      success: (res) => {
        if (!res.ok) {
           throw new Error('فشلت الجدولة. تحقق من الوقت المدخل.');
        }
        return `تمت جدولة البث بنجاح في الساعة ${scheduledTime} UTC.`;
      },
      error: (err) => `حدث خطأ: ${err.message}`,
    }).finally(() => {
      setIsScheduling(false);
    });
  };

  return (
    <>
      {/* Toaster component for displaying notifications */}
      <Toaster 
        position="top-center"
        toastOptions={{
          className: 'bg-gray-800 text-white',
          duration: 5000,
        }}
      />
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-lg p-8 space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">تحكم في بث GitHub</h1>
            <p className="text-gray-400">ابدأ أو جدول بث GitHub Actions بضغطة زر.</p>
          </div>

          {/* Immediate Dispatch Section */}
          <div className="flex flex-col">
            <button
              onClick={handleDispatchNow}
              disabled={isDispatching || isScheduling}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 duration-300 ease-in-out"
            >
              {isDispatching ? 'جاري البدء...' : 'ابدأ البث الآن'}
            </button>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-800 px-2 text-gray-400">أو</span>
            </div>
          </div>


          {/* Scheduled Dispatch Section */}
          <div className="space-y-4">
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              disabled={isDispatching || isScheduling}
              className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-lg"
            />
            <button
              onClick={handleSchedule}
              disabled={!scheduledTime || isScheduling || isDispatching}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 duration-300 ease-in-out"
            >
              {isScheduling ? 'جاري الجدولة...' : 'جدول البث في هذا الوقت'}
            </button>
          </div>
        </div>
        <footer className="text-center mt-8 text-gray-500">
          <p>
            يعمل هذا التطبيق باستخدام Vercel Cron Jobs.
          </p>
        </footer>
      </main>
    </>
  );
}
