import React from 'react';
import { TabItem } from '../../../packages/core/utils/ui';
import './Tabs.css';

interface TabsProps {
    tabs: TabItem[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
    tabs,
    activeTab,
    onTabChange,
    className = ''
}) => {
    const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

    return (
        <div className={`tabs-container ${className}`}>
            <div className="tabs-header">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-button ${tab.id === activeTab ? 'active' : ''}`}
                        onClick={() => onTabChange(tab.id)}
                        title={tab.label}
                    >
                        {tab.icon && <span className="tab-icon">{tab.icon}</span>}
                        <span className="tab-label">{tab.label}</span>
                    </button>
                ))}
            </div>
            <div className="tabs-content">
                {activeTabContent}
            </div>
        </div>
    );
};