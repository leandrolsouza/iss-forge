import React, { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';
import { getEditor } from './editors';

export default function TabBar({ tabs, activeTab, onSelectTab, onCloseTab }) {
  const { t } = useI18n();
  const barRef = useRef(null);

  // Keep the active tab visible when it changes (keyboard switching, many tabs)
  useEffect(() => {
    const el = barRef.current?.querySelector('.tab.active');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab, tabs.length]);

  // Vertical mouse wheel scrolls the strip horizontally
  const onWheel = (e) => {
    const bar = barRef.current;
    if (bar && Math.abs(e.deltaY) > Math.abs(e.deltaX)) bar.scrollLeft += e.deltaY;
  };

  return (
    <div className="tab-bar" role="tablist" ref={barRef} onWheel={onWheel}>
      {tabs.map((tab) => {
        const editor = getEditor(tab.id);
        // Label follows the current language (the stored one was fixed at open time)
        const label = editor ? t(editor.labelKey) : tab.label;
        const active = tab.id === activeTab;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={`tab ${active ? 'active' : ''}`}
            onClick={() => onSelectTab(tab.id)}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                onCloseTab(tab.id);
              }
            }}
            onMouseDown={(e) => e.button === 1 && e.preventDefault()} // no autoscroll cursor
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectTab(tab.id);
              }
            }}
            title={label}
          >
            {editor && (
              <span className="tab-icon">
                <editor.Icon size={14} />
              </span>
            )}
            <span className="tab-label">{label}</span>
            <button
              className="tab-close"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              title={t('closeTabHint')}
              aria-label={`${t('closeTab')} ${label}`}
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
