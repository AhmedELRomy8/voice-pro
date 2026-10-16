import React, { useState } from 'react';
import { Search, Globe, Settings as SettingsIcon, Menu, User, ShieldCheck, LogOut, LogIn } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import type { UserProfile } from '../../services/auth/authService';

interface HeaderProps {
  user: UserProfile | null;
  onOpenSettings: () => void;
  onToggleMobileSidebar?: () => void;
  onLogout: () => void;
  onOpenLogin: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenSettings,
  onToggleMobileSidebar,
  onLogout,
  onOpenLogin,
  searchQuery = '',
  onSearchChange,
}) => {
  const { lang, setLanguage, t } = useTranslation();
  const [showUserMenu, setShowUserMenu] = useState(false);

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

        {/* User Profile & Google Login Dropdown */}
        <div className="vox-user-avatar-container">
          {user && user.provider !== 'guest' ? (
            <button
              className="vox-user-avatar-btn"
              onClick={() => setShowUserMenu(!showUserMenu)}
              title={user.name}
              aria-label="User profile menu"
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="vox-user-img" />
              ) : (
                <div className="vox-user-initials">{user.name.charAt(0).toUpperCase()}</div>
              )}
            </button>
          ) : (
            <button
              className="vox-login-pill-btn"
              onClick={onOpenLogin}
              title="Sign in with Google"
            >
              <LogIn size={15} />
              <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
          )}

          {showUserMenu && user && (
            <div className="vox-user-dropdown-card">
              <div className="vox-user-dropdown-info">
                <span className="vox-user-name">{user.name}</span>
                <span className="vox-user-email">{user.email}</span>
                {user.provider === 'google' && (
                  <span className="vox-google-connected-pill">Google Connected</span>
                )}
              </div>
              <div className="vox-dropdown-divider" />
              <button
                className="vox-dropdown-action-btn text-danger"
                onClick={() => {
                  setShowUserMenu(false);
                  onLogout();
                }}
              >
                <LogOut size={15} />
                <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
