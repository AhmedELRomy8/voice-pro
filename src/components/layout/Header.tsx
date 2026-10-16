import React from 'react';
import { Search, Globe, Settings as SettingsIcon, Menu, User, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface HeaderProps {
  onOpenSettings: () => void;
  onToggleMobileSidebar?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onToggleMobileSidebar,
  searchQuery = '',
  onSearchChange,
}) => {
  const { lang, setLanguage, t, isRtl } = useTranslation();

  return (
    <header className="vox-top-header">
      <div className="vox-header-left">
        {onToggleMobileSidebar && (
          <button 
            className="vox-menu-toggle-btn" 
            onClick={onToggleMobileSidebar}
            aria-label="Toggle menu"
          >
            <Menu size={22} />
          </button>
        )}

        <div className="vox-search-bar">
          <Search size={17} className="vox-search-icon" />
          <input
            type="text"
            className="vox-search-input"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="vox-header-right">
        <div className="vox-status-badge" title={t.privacyNoticeBody}>
          <ShieldCheck size={14} className="text-success" />
          <span className="vox-badge-text">{t.localEngine}</span>
        </div>

        <button
          className="vox-header-btn"
          onClick={() => setLanguage(lang === 'ar' ? 'en' : 'ar')}
          title="Switch language / تغيير اللغة"
        >
          <Globe size={18} />
          <span className="vox-lang-tag">{lang === 'ar' ? 'EN' : 'عربي'}</span>
        </button>

        <button
          className="vox-header-btn"
          onClick={onOpenSettings}
          title={t.settings}
          aria-label={t.settings}
        >
          <SettingsIcon size={18} />
        </button>

        <div className="vox-user-avatar" title="VoxNote User">
          <User size={16} />
        </div>
      </div>
    </header>
  );
};
