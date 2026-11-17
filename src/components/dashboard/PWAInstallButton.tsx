import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'sidebar' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'sidebar' }) => {
  const { canInstall, isIOS, hasNativePrompt, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (!canInstall) return null;

  const handleClick = async () => {
    if (hasNativePrompt) {
      await promptInstall();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          variant === 'compact'
            ? 'min-h-[44px] px-3 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0'
            : 'w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs bg-slate-800/80 hover:bg-slate-700 text-teal-300 border border-teal-500/30 transition cursor-pointer'
        }
        title="Cài đặt ứng dụng Voyager để xem lịch trình khi mất mạng"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={variant === 'compact' ? 'hidden sm:inline' : ''}>
          {variant === 'compact' ? 'Cài ứng dụng' : 'Cài đặt xem Offline'}
        </span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-200 p-5 shadow-2xl text-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900">Cài đặt Voyager trên iOS</h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Để hướng dẫn viên sử dụng lịch trình offline trên iPhone/iPad:
            </p>
            <ol className="text-xs text-slate-700 space-y-2 list-decimal pl-4">
              <li className="flex items-center gap-1.5">
                Nhấn biểu tượng <Share className="w-3.5 h-3.5 text-sky-600 inline" /> <strong>Chia sẻ</strong> trên thanh Safari.
              </li>
              <li>Chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong>.</li>
              <li>Nhấn <strong>Thêm</strong> để mở ứng dụng toàn màn hình và tra cứu khi mất mạng.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
};
