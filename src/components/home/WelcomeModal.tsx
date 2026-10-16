import React, { useState } from 'react';
import {
  Mic,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  ArrowRight,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueGuest: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onContinueGuest,
}) => {
  const { lang, isRtl } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  return (
    <div className="vox-welcome-overlay">
      <div className="vox-welcome-dialog">
        {/* Close Button */}
        <button className="vox-welcome-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        {/* Left Dark Hero Panel */}
        <div className="vox-welcome-left-panel">
          <div className="vox-welcome-brand">
            <div className="vox-brand-mark">
              <span className="wave-bar h-1"></span>
              <span className="wave-bar h-3"></span>
              <span className="wave-bar h-2"></span>
              <span className="wave-bar h-4"></span>
              <span className="wave-bar h-2"></span>
            </div>
            <span className="vox-brand-title-large">VoxNote</span>
          </div>

          <div className="vox-welcome-hero-content">
            <h2 className="vox-welcome-hero-title">Your Voice. Your Documents.</h2>
            <p className="vox-welcome-hero-desc">
              Convert speech, images and tables into clean text and professional files — offline or online.
            </p>

            <div className="vox-welcome-features-grid">
              <div className="vox-welcome-feat-card">
                <div className="vox-welcome-feat-icon text-success">
                  <Mic size={18} />
                </div>
                <div>
                  <div className="vox-welcome-feat-name">Speech to Text</div>
                  <div className="vox-welcome-feat-sub">Speak, get text</div>
                </div>
              </div>

              <div className="vox-welcome-feat-card">
                <div className="vox-welcome-feat-icon text-purple">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <div className="vox-welcome-feat-name">Image to Text</div>
                  <div className="vox-welcome-feat-sub">Extract from images</div>
                </div>
              </div>

              <div className="vox-welcome-feat-card">
                <div className="vox-welcome-feat-icon text-primary">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="vox-welcome-feat-name">Image to Word</div>
                  <div className="vox-welcome-feat-sub">Recreate documents</div>
                </div>
              </div>

              <div className="vox-welcome-feat-card">
                <div className="vox-welcome-feat-icon text-warning">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <div className="vox-welcome-feat-name">Image to Excel</div>
                  <div className="vox-welcome-feat-sub">Extract tables</div>
                </div>
              </div>
            </div>
          </div>

          <div className="vox-welcome-bottom-tag">
            <span>| Simple • Fast • Offline Ready</span>
          </div>
        </div>

        {/* Right Light Auth Panel */}
        <div className="vox-welcome-right-panel">
          <div className="vox-auth-container">
            <h3 className="vox-auth-title">Welcome Back</h3>
            <p className="vox-auth-sub">Sign in to continue to VoxNote</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onContinueGuest();
              }}
              className="vox-auth-form"
            >
              <div className="vox-auth-input-group">
                <input
                  type="text"
                  className="vox-auth-input"
                  placeholder="Username or Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="vox-auth-input-group password-group">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="vox-auth-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button type="submit" className="vox-auth-btn-primary">
                Login
              </button>

              <div className="vox-auth-or-divider">
                <span>or</span>
              </div>

              <button
                type="button"
                className="vox-auth-btn-guest"
                onClick={onContinueGuest}
              >
                <span>Continue without account</span>
                <ArrowRight size={16} />
              </button>

              <p className="vox-auth-footer-note">
                No account? Just start and get things done.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
