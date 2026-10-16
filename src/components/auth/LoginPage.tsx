import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  WifiOff,
  Zap,
  Eye,
  EyeOff,
  Settings as SettingsIcon
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import {
  loginWithEmail,
  loginAsGuest,
  saveUser,
  type UserProfile
} from '../../services/auth/authService';
import {
  renderGoogleSignInButton,
  getStoredGoogleClientId,
  storeGoogleClientId,
} from '../../services/auth/googleAuth';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { lang, isRtl, t } = useTranslation();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;
  const isAr = lang === 'ar';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [gsiStatus, setGsiStatus] = useState<'loading' | 'ready' | 'no-client-id' | 'failed'>('loading');
  const [clientIdInput, setClientIdInput] = useState('');
  const [showClientIdSetup, setShowClientIdSetup] = useState(false);

  const googleBtnSlotRef = useRef<HTMLDivElement | null>(null);

  // Render the official Google button once GIS is ready
  useEffect(() => {
    if (gsiStatus !== 'loading' && gsiStatus !== 'ready') return;
    let cancelled = false;

    (async () => {
      if (!googleBtnSlotRef.current) return;
      const failure = await renderGoogleSignInButton(googleBtnSlotRef.current, (profile) => {
        if (cancelled) return;
        const user: UserProfile = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatar: profile.avatar,
          provider: 'google',
        };
        saveUser(user);
        onLoginSuccess(user);
      });
      if (cancelled) return;
      if (failure === null) {
        setGsiStatus('ready');
      } else if (failure === 'no-client-id') {
        setGsiStatus('no-client-id');
      } else {
        setGsiStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gsiStatus, onLoginSuccess]);

  const handleSaveClientId = () => {
    const trimmed = clientIdInput.trim();
    if (!trimmed.endsWith('.apps.googleusercontent.com')) {
      setLoginError(
        isAr
          ? 'معرف العميل غير صالح — لازم ينتهي بـ apps.googleusercontent.com'
          : 'Invalid client ID — must end with .apps.googleusercontent.com'
      );
      return;
    }
    storeGoogleClientId(trimmed);
    setClientIdInput('');
    setLoginError(null);
    setShowClientIdSetup(false);
    setGsiStatus('loading');
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanedEmail = email.trim().toLowerCase();
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail);

    if (!emailLooksValid) {
      setLoginError(
        isAr
          ? 'من فضلك أدخل بريداً إلكترونياً صحيحاً.'
          : 'Please enter a valid email address.'
      );
      return;
    }

    if (!password || password.length < 4) {
      setLoginError(
        isAr
          ? 'كلمة المرور يجب ألا تقل عن 4 أحرف.'
          : 'Password must be at least 4 characters.'
      );
      return;
    }

    setIsLoadingEmail(true);
    try {
      const user = await loginWithEmail(cleanedEmail);
      onLoginSuccess(user);
    } catch {
      setLoginError(
        isAr
          ? 'فشل تسجيل الدخول. حاول مرة أخرى.'
          : 'Sign in failed. Try again.'
      );
    } finally {
      setIsLoadingEmail(false);
    }
  };

  const handleGuestSignIn = () => {
    setLoginError(null);
    const user = loginAsGuest();
    onLoginSuccess(user);
  };

  const features = [
    {
      icon: Mic,
      title: isAr ? 'تحويل الصوت إلى نص' : 'Speech to Text',
      desc: isAr ? 'إملاء فوري والنتيجة تظهر أثناء الكلام' : 'Realtime dictation as you speak',
      tone: 'speech'
    },
    {
      icon: ImageIcon,
      title: isAr ? 'استخراج النص من الصور' : 'Image to Text',
      desc: isAr ? 'OCR عربي وإنجليزي عالي الدقة' : 'High-accuracy AR/EN OCR',
      tone: 'ocr'
    },
    {
      icon: FileText,
      title: isAr ? 'تحويل إلى Word' : 'Image to Word',
      desc: isAr ? 'ملفات DOCX منسقة قابلة للتعديل' : 'Editable, formatted DOCX',
      tone: 'word'
    },
    {
      icon: FileSpreadsheet,
      title: isAr ? 'تحويل الجداول إلى Excel' : 'Table to Excel',
      desc: isAr ? 'كشف الجداول تلقائياً وتصدير XLSX' : 'Auto table detection, XLSX export',
      tone: 'excel'
    }
  ];

  return (
    <div className="lx-login-scene" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Ambient decorative blobs */}
      <div className="lx-blob lx-blob-1" aria-hidden="true" />
      <div className="lx-blob lx-blob-2" aria-hidden="true" />
      <div className="lx-blob lx-blob-3" aria-hidden="true" />

      <div className="lx-login-grid">
        {/* ── Brand showcase side ─────────────────────────────── */}
        <div className="lx-showcase">
          <div className="lx-brand-row">
            <div className="lx-brand-mark" aria-hidden="true">
              <span className="lx-wave h-1" />
              <span className="lx-wave h-2" />
              <span className="lx-wave h-3" />
              <span className="lx-wave h-4" />
              <span className="lx-wave h-2" />
            </div>
            <span className="lx-brand-name">VoxNote</span>
          </div>

          <div className="lx-showcase-body">
            <h1 className="lx-hero-title">
              {isAr ? (
                <>
                  صوتك.
                  <br />
                  <span className="lx-hero-accent">مستنداتك.</span>
                </>
              ) : (
                <>
                  Your voice.
                  <br />
                  <span className="lx-hero-accent">Your documents.</span>
                </>
              )}
            </h1>
            <p className="lx-hero-desc">
              {isAr
                ? 'حوّل الصوت والصور والـ PDF إلى نصوص نظيفة وملفات Word و Excel احترافية — كل ذلك يعمل داخل جهازك.'
                : 'Turn speech, images and PDFs into clean text and professional Word & Excel files — all on your device.'}
            </p>
          </div>

          <ul className="lx-feat-list">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.title} className={`lx-feat-item tone-${f.tone}`}>
                  <span className="lx-feat-icon">
                    <Icon size={17} />
                  </span>
                  <span className="lx-feat-text">
                    <span className="lx-feat-title">{f.title}</span>
                    <span className="lx-feat-desc">{f.desc}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="lx-trust-row">
            <span className="lx-trust-chip">
              <ShieldCheck size={13} />
              {isAr ? 'خصوصية كاملة' : 'Private by design'}
            </span>
            <span className="lx-trust-chip">
              <WifiOff size={13} />
              {isAr ? 'يعمل دون إنترنت' : 'Offline ready'}
            </span>
            <span className="lx-trust-chip">
              <Zap size={13} />
              {isAr ? 'سريع جداً' : 'Blazing fast'}
            </span>
          </div>
        </div>

        {/* ── Sign-in side ────────────────────────────────────── */}
        <div className="lx-auth-side">
          <div className="lx-auth-card">
            <div className="lx-auth-mobile-brand">
              <div className="lx-brand-mark" aria-hidden="true">
                <span className="lx-wave h-1" />
                <span className="lx-wave h-2" />
                <span className="lx-wave h-3" />
                <span className="lx-wave h-4" />
                <span className="lx-wave h-2" />
              </div>
              <span className="lx-brand-name">VoxNote</span>
            </div>

            <h2 className="lx-auth-title">{t.welcomeBack}</h2>
            <p className="lx-auth-sub">
              {isAr
                ? 'سجّل الدخول للوصول إلى مستنداتك ومتابعة عملك.'
                : 'Sign in to access your documents and keep working.'}
            </p>

            {/* Google — real Identity Services button */}
            {gsiStatus === 'ready' || gsiStatus === 'loading' ? (
              <div
                ref={googleBtnSlotRef}
                className="lx-gsi-slot"
                style={{ display: 'flex', justifyContent: 'center', minHeight: 48 }}
              />
            ) : (
              <div className="lx-gsi-fallback">
                <button
                  type="button"
                  className="lx-google-btn"
                  onClick={() => setShowClientIdSetup(true)}
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>
                    {isAr ? 'المتابعة باستخدام Google' : 'Continue with Google'}
                  </span>
                </button>

                {gsiStatus === 'failed' && (
                  <p className="lx-gsi-hint">
                    {isAr
                      ? 'تعذر تحميل خدمة جوجل — تأكد من الاتصال بالإنترنت.'
                      : 'Could not load Google service — check your connection.'}
                  </p>
                )}

                {showClientIdSetup && (
                  <div className="lx-clientid-setup">
                    <p className="lx-clientid-title">
                      {isAr
                        ? 'ضع Google Client ID لتفعيل الدخول بجوجل:'
                        : 'Paste your Google Client ID to enable sign-in:'}
                    </p>
                    <p className="lx-clientid-help">
                      {isAr ? 'من ' : 'From '}
                      <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" dir="ltr">
                        console.cloud.google.com/apis/credentials
                      </a>
                      {isAr
                        ? ' — أنشئ OAuth Client من نوع Web، وأضف ' : ' — create a Web OAuth Client and add '}
                      <code dir="ltr">{window.location.origin}</code>
                      {isAr ? ' كـ Authorized JavaScript origin.' : ' as an Authorized JavaScript origin.'}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="lx-field-input"
                        placeholder="xxxxx.apps.googleusercontent.com"
                        value={clientIdInput}
                        onChange={(e) => setClientIdInput(e.target.value)}
                        dir="ltr"
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="lx-submit-btn" style={{ width: 'auto', paddingInline: '1rem' }} onClick={handleSaveClientId}>
                        {isAr ? 'حفظ' : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="lx-divider">
              <span>{isAr ? 'أو' : 'or'}</span>
            </div>

            {/* Email form */}
            <form onSubmit={handleEmailSignIn} className="lx-email-form" noValidate>
              <div className="lx-field">
                <label htmlFor="lx-email" className="lx-field-label">
                  {isAr ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <input
                  id="lx-email"
                  type="email"
                  className="lx-field-input"
                  placeholder={isAr ? 'name@example.com' : 'name@example.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  dir="ltr"
                />
              </div>

              <div className="lx-field">
                <label htmlFor="lx-password" className="lx-field-label">
                  {isAr ? 'كلمة المرور' : 'Password'}
                </label>
                <div className="lx-field-password">
                  <input
                    id="lx-password"
                    type={showPassword ? 'text' : 'password'}
                    className="lx-field-input"
                    placeholder={isAr ? '••••••••' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    className="lx-pw-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : (isAr ? 'إظهار كلمة المرور' : 'Show password')}
                  >
                    {showPassword ? (
                    <EyeOff size={15} />
                  ) : (
                    <Eye size={15} />
                  )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="lx-submit-btn"
                disabled={isLoadingEmail}
              >
                {isLoadingEmail
                  ? isAr
                    ? 'جارٍ الدخول...'
                    : 'Signing in...'
                  : isAr
                    ? 'تسجيل الدخول'
                    : 'Sign in'}
                <ArrowIcon size={15} />
              </button>
            </form>

            {loginError && (
              <div className="lx-login-error">{loginError}</div>
            )}

            <button
              type="button"
              className="lx-guest-btn"
              onClick={handleGuestSignIn}
              disabled={isLoadingEmail}
            >
              {isAr ? 'المتابعة بدون حساب' : 'Continue without account'}
              <ArrowIcon size={14} />
            </button>

            <p className="lx-auth-note">
              {isAr
                ? 'بياناتك تُخزَّن محلياً على جهازك فقط، ولا تُرسل لأي خادم.'
                : 'Your data is stored locally on your device only — never sent to a server.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
