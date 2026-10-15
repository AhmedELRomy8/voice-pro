import React from 'react';
import { Mic, ShieldCheck, Globe, Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const { lang, setLanguage, t } = useTranslation();

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-icon">
          <Mic size={22} />
        </div>
        <div>
          <h1 className="brand-title">{t.appTitle}</h1>
          <p className="brand-subtitle">{t.appSubtitle}</p>
        </div>
      </div>

      <div className="header-actions">
        <div className="badge-local" title={t.privacyNoticeBody}>
          <ShieldCheck size={16} />
          <span>{t.localEngine}</span>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setLanguage(lang === 'ar' ? 'en' : 'ar')}
          title="Switch language"
        >
          <Globe size={15} />
          <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        <button
          className="btn btn-secondary btn-icon"
          onClick={onOpenSettings}
          title={t.settings}
          aria-label={t.settings}
        >
          <SettingsIcon size={18} />
        </button>
      </div>
    </header>
  );
};
