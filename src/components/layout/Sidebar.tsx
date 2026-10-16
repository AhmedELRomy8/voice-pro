import React from 'react';
import {
  Home,
  Mic,
  Image,
  FileText,
  FileSpreadsheet,
  Clock,
  Settings,
  X
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

export type NavigationTab = 
  | 'home' 
  | 'speech' 
  | 'ocr' 
  | 'word' 
  | 'excel' 
  | 'recent' 
  | 'settings';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { t } = useTranslation();

  const navItems = [
    { id: 'home' as NavigationTab, label: t.home, icon: Home },
    { id: 'speech' as NavigationTab, label: t.actionSpeechToText, icon: Mic },
    { id: 'ocr' as NavigationTab, label: t.actionImageToText, icon: Image },
    { id: 'word' as NavigationTab, label: t.actionImageToWord, icon: FileText },
    { id: 'excel' as NavigationTab, label: t.actionImageToExcel, icon: FileSpreadsheet },
    { id: 'recent' as NavigationTab, label: t.recentDocuments, icon: Clock },
    { id: 'settings' as NavigationTab, label: t.settings, icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`vox-sidebar ${isOpenMobile ? 'mobile-open' : ''}`}>
        {/* Logo Section */}
        <div className="vox-logo-area">
          <div className="vox-brand-mark">
            <span className="wave-bar h-1"></span>
            <span className="wave-bar h-3"></span>
            <span className="wave-bar h-2"></span>
            <span className="wave-bar h-4"></span>
            <span className="wave-bar h-2"></span>
          </div>
          <span className="vox-brand-text">VoxNote</span>

          {isOpenMobile && (
            <button 
              className="vox-sidebar-close" 
              onClick={onCloseMobile}
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="vox-nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`vox-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
              >
                <Icon size={19} className="vox-nav-icon" />
                <span className="vox-nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Version Tag */}
        <div className="vox-sidebar-footer">
          <div className="vox-version-tag">v1.0.0</div>
        </div>
      </aside>
    </>
  );
};
