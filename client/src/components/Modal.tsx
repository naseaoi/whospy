import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title?: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'alert' | 'confirm';
  disableBackdropClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen, onClose, onConfirm, title, children,
  confirmText = "确定", cancelText = "取消", type = 'alert',
  disableBackdropClick = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={disableBackdropClick ? undefined : onClose}
      ></div>
      
      {/* Content */}
      <div className="relative bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm border border-white/10 overflow-hidden transform transition-all scale-100 animate-fade-in-up">
        {title && (
            <div className="bg-gray-900/50 px-6 py-4 border-b border-white/5 text-center">
                <h3 className="text-lg font-bold text-white">{title}</h3>
            </div>
        )}
        
        <div className="px-6 py-6 text-gray-200">
          {children}
        </div>

        <div className="flex border-t border-white/5 divide-x divide-white/5 bg-gray-900/30">
            {type === 'confirm' && (
                <button 
                    onClick={onClose}
                    className="flex-1 py-4 text-gray-400 hover:bg-white/5 hover:text-white transition font-medium active:bg-white/10"
                >
                    {cancelText}
                </button>
            )}
            <button 
                onClick={() => {
                    if (onConfirm) onConfirm();
                    else onClose();
                }}
                className={`flex-1 py-4 font-bold transition active:bg-white/10 ${type === 'confirm' ? 'text-blue-400 hover:bg-blue-500/10' : 'text-blue-400 hover:bg-white/5'}`}
            >
                {confirmText}
            </button>
        </div>
      </div>
    </div>
  );
};
