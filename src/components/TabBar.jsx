import React from 'react';

export default function TabBar({ tabs, activeTab, onSelectTab, onCloseTab }) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTab ? 'active' : ''}`}
          onClick={() => onSelectTab(tab.id)}
        >
          <span className="tab-label">{tab.label}</span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab.id);
            }}
            title="Fechar"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
