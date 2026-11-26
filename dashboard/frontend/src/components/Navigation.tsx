import React from 'react';
import { Blocks, Cpu, Gauge, Layers, Network, Terminal } from 'lucide-react';
import { useT } from '../i18n';
import { Lang, NavTab } from '../types';

interface NavProps {
  active: NavTab;
  onChange: (tab: NavTab) => void;
  lang: Lang;
}

export const Navigation: React.FC<NavProps> = ({ active, onChange, lang }) => {
  const t = useT(lang);

  const items: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: t('navOverview'), icon: <Gauge className="w-5 h-5" /> },
    { id: 'mempool', label: t('navMempool'), icon: <Layers className="w-5 h-5" /> },
    { id: 'explorer', label: t('navExplorer'), icon: <Blocks className="w-5 h-5" /> },
    { id: 'network', label: t('navNetwork'), icon: <Network className="w-5 h-5" /> },
    { id: 'tools', label: t('navTools'), icon: <Terminal className="w-5 h-5" /> },
  ];

  return (
    <>
      {/* Desktop Material 3 Navigation Rail */}
      <aside className="hidden lg:flex flex-col gap-2 w-24 shrink-0 sticky top-24 self-start">
        <div className="m3-glass rounded-[28px] p-2.5 flex flex-col items-center gap-2">
          {items.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className="w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[20px] transition group"
                style={
                  isActive
                    ? { background: 'var(--m3-primary-container)', color: 'var(--m3-on-primary-container)' }
                    : undefined
                }
              >
                <div className={`transition-transform ${isActive ? 'scale-110' : 'opacity-70 group-hover:opacity-100'}`}>
                  {item.icon}
                </div>
                <span className={`text-[11px] font-medium leading-tight text-center ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
          <div className="pt-2 mt-1 border-t border-white/10 w-full flex flex-col items-center opacity-50 text-[10px]">
            <Cpu className="w-3.5 h-3.5 mb-0.5" />
            <span>MWEB</span>
          </div>
        </div>
      </aside>

      {/* Mobile Floating Glass Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40">
        <div className="m3-glass-elevated m3-pill px-2 py-1.5 flex items-center justify-around">
          {items.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 m3-pill transition"
                style={
                  isActive
                    ? { background: 'var(--m3-primary-container)', color: 'var(--m3-on-primary-container)' }
                    : undefined
                }
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
