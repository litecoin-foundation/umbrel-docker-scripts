import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { api } from '../api';
import { useT } from '../i18n';
import { Lang } from '../types';

interface AdminModalProps {
  open: boolean;
  fullLock?: boolean;
  lang: Lang;
  onClose: () => void;
  onSuccess: (token: string) => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ open, fullLock = false, lang, onClose, onSuccess }) => {
  const t = useT(lang);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(password);
      setPassword('');
      onSuccess(res.token);
    } catch {
      setError(t('wrongPassword'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center px-4"
      onClick={fullLock ? undefined : onClose}
    >
      <div
        className="w-full max-w-md m3-glass-elevated rounded-[28px] p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--m3-primary-container)', color: 'var(--m3-on-primary-container)' }}
            >
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">{t('adminLoginTitle')}</h3>
              <p className="text-xs opacity-70 mt-0.5">{fullLock ? t('fullLockDesc') : t('adminLoginDesc')}</p>
            </div>
          </div>
          {!fullLock && (
            <button onClick={onClose} className="p-1 opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            className="w-full px-4 py-3 rounded-2xl bg-black/25 border border-white/15 outline-none focus:border-blue-400 text-sm"
          />
          {error && <div className="text-xs text-rose-400">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            {!fullLock && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 m3-pill text-xs font-medium opacity-75 hover:opacity-100"
              >
                {t('cancel')}
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="px-5 py-2 m3-pill text-xs font-semibold text-white transition disabled:opacity-50"
              style={{ background: 'var(--m3-primary-strong)' }}
            >
              {loading ? '…' : t('signIn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
