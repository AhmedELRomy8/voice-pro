import React, { useState } from 'react';
import {
  Mic,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
  Lock
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';
import { loginWithGoogle, loginWithEmail, loginAsGuest, type UserProfile } from '../../services/auth/authService';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { lang, isRtl } = useTranslation();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoadingGoogle(true);
    try {
      const user = await loginWithGoogle();
      onLoginSuccess(user);
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = await loginWithEmail(email || 'user@voxnote.com');
    onLoginSuccess(user);
  };

  const handleGuestSignIn = () => {
    const user = loginAsGuest();
    onLoginSuccess(user);
  };

  return (
    <div className="vox-login-page-wrapper">
      <div className="vox-login-card">
        {/* Left Dark Hero Panel */}
        <div className="vox-login-hero-side">
          <div className="vox-login-brand">
            <div className="vox-brand-mark">
              <span className="wave-bar h-1"></span>
              <span className="wave-bar h-3"></span>
              <span className="wave-bar h-2"></span>
              <span className="wave-bar h-4"></span>
              <span className="wave-bar h-2"></span>
            </div>
            <span className="vox-brand-title-large">VoxNote</span>
          </div>

          <div className="vox-login-hero-body">
            <h1 className="vox-hero-headline">
              {lang === 'ar' ? 'صوتك. مستنداتك.' : 'Your Voice. Your Documents.'}
            </h1>
            <p className="vox-hero-tagline">
              {lang === 'ar'
                ? 'تحويل الصوت والصور والجداول إلى نصوص وملفات Word وإكسل احترافية — محلياً وأونلاين.'
                : 'Convert speech, images and tables into clean text and professional files — offline or online.'}
            </p>

            <div className="vox-hero-features-grid">
              <div className="vox-hero-feat-item">
                <div className="vox-hero-feat-icon icon-speech">
                  <Mic size={18} />
                </div>
                <div>
                  <div className="vox-hero-feat-title">Speech to Text</div>
                  <div className="vox-hero-feat-desc">Speak, get text</div>
                </div>
              </div>

              <div className="vox-hero-feat-item">
                <div className="vox-hero-feat-icon icon-ocr">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <div className="vox-hero-feat-title">Image to Text</div>
                  <div className="vox-hero-feat-desc">Extract from images</div>
                </div>
              </div>

              <div className="vox-hero-feat-item">
                <div className="vox-hero-feat-icon icon-word">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="vox-hero-feat-title">Image to Word</div>
                  <div className="vox-hero-feat-desc">Recreate documents</div>
                </div>
              </div>

              <div className="vox-hero-feat-item">
                <div className="vox-hero-feat-icon icon-excel">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <div className="vox-hero-feat-title">Image to Excel</div>
                  <div className="vox-hero-feat-desc">Extract tables</div>
                </div>
              </div>
            </div>
          </div>

          <div className="vox-hero-bottom-tag">
            <span>| Simple • Fast • Offline Ready</span>
          </div>
        </div>

        {/* Right Light Auth Panel */}
        <div className="vox-login-form-side">
          <div className="vox-auth-box">
            <h2 className="vox-auth-main-title">
              {lang === 'ar' ? 'مرحباً بعودتك' : 'Welcome Back'}
            </h2>
            <p className="vox-auth-sub-title">
              {lang === 'ar' ? 'سجل الدخول للمتابعة إلى VoxNote' : 'Sign in to continue to VoxNote'}
            </p>

            {/* Google Authentication Button */}
            <button
              type="button"
              className="vox-google-auth-btn"
              onClick={handleGoogleSignIn}
              disabled={isLoadingGoogle}
            >
              {/* Google Official SVG Logo */}
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
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
                {isLoadingGoogle
                  ? (lang === 'ar' ? 'جارٍ تسجيل الدخول...' : 'Signing in...')
                  : (lang === 'ar' ? 'تسجيل الدخول باستخدام Google' : 'Sign in with Google')}
              </span>
            </button>

            <div className="vox-auth-divider">
              <span>{lang === 'ar' ? 'أو عبر البريد' : 'or with email'}</span>
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleEmailSignIn} className="vox-login-inputs-form">
              <div className="vox-input-wrap">
                <input
                  type="text"
                  className="vox-form-input"
                  placeholder={lang === 'ar' ? 'اسم المستخدم أو البريد الإلكتروني' : 'Username or Email'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="vox-input-wrap password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="vox-form-input"
                  placeholder={lang === 'ar' ? 'كلمة المرور' : 'Password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="vox-pw-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button type="submit" className="vox-primary-submit-btn">
                {lang === 'ar' ? 'تسجيل الدخول' : 'Login'}
              </button>
            </form>

            <div className="vox-auth-divider">
              <span>{lang === 'ar' ? 'أو' : 'or'}</span>
            </div>

            {/* Continue without account button */}
            <button
              type="button"
              className="vox-guest-continue-btn"
              onClick={handleGuestSignIn}
            >
              <span>{lang === 'ar' ? 'المتابعة بدون حساب' : 'Continue without account'}</span>
              <ArrowIcon size={16} />
            </button>

            <p className="vox-login-footnote">
              {lang === 'ar'
                ? 'ليس لديك حساب؟ يمكنك البدء فوراً والإنجاز بدون أي قيود.'
                : 'No account? Just start and get things done.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
