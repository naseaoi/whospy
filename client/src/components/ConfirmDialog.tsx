import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, HelpCircle, Info } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  type = 'warning'
}) => {
  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <AlertTriangle size={64} />;
      case 'warning':
        return <HelpCircle size={64} />;
      case 'info':
        return <Info size={64} />;
      default:
        return <HelpCircle size={64} />;
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'danger':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-yellow-400';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      onConfirm={onConfirm}
      title={title}
      type="confirm"
      confirmText={confirmText}
      cancelText={cancelText}
    >
      <div className="text-center py-4">
        <div className={`text-6xl mb-4 ${getIconColor()}`}>
          {getIcon()}
        </div>
        <div className="text-gray-300 text-base leading-relaxed">
          {message}
        </div>
      </div>
    </Modal>
  );
};
