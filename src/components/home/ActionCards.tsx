import React from 'react';
import { Mic, Image as ImageIcon, FileText, FileSpreadsheet, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface ActionCardsProps {
  onSelectSpeech: () => void;
  onSelectOcr: () => void;
  onSelectWord: () => void;
  onSelectExcel: () => void;
}

export const ActionCards: React.FC<ActionCardsProps> = ({
  onSelectSpeech,
  onSelectOcr,
  onSelectWord,
  onSelectExcel,
}) => {
  const { t, isRtl } = useTranslation();
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="vox-action-cards-grid" role="region" aria-label="Main Actions">
      {/* 1. Speech to Text */}
      <div
        className="vox-card card-speech"
        onClick={onSelectSpeech}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectSpeech()}
      >
        <div className="vox-card-header">
          <div className="vox-card-icon-pill icon-speech">
            <Mic size={24} />
          </div>
          <div className="vox-wave-decoration wave-speech">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
        <div className="vox-card-body">
          <h3 className="vox-card-title">{t.actionSpeechToText}</h3>
          <p className="vox-card-desc">{t.actionSpeechToTextDesc}</p>
        </div>
        <div className="vox-card-arrow-row">
          <div className="vox-card-arrow arrow-speech">
            <ArrowIcon size={18} />
          </div>
        </div>
      </div>

      {/* 2. Image to Text */}
      <div
        className="vox-card card-ocr"
        onClick={onSelectOcr}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectOcr()}
      >
        <div className="vox-card-header">
          <div className="vox-card-icon-pill icon-ocr">
            <ImageIcon size={24} />
          </div>
          <div className="vox-wave-decoration wave-ocr">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
        <div className="vox-card-body">
          <h3 className="vox-card-title">{t.actionImageToText}</h3>
          <p className="vox-card-desc">{t.actionImageToTextDesc}</p>
        </div>
        <div className="vox-card-arrow-row">
          <div className="vox-card-arrow arrow-ocr">
            <ArrowIcon size={18} />
          </div>
        </div>
      </div>

      {/* 3. Image to Word */}
      <div
        className="vox-card card-word"
        onClick={onSelectWord}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectWord()}
      >
        <div className="vox-card-header">
          <div className="vox-card-icon-pill icon-word">
            <FileText size={24} />
          </div>
          <div className="vox-wave-decoration wave-word">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
        <div className="vox-card-body">
          <h3 className="vox-card-title">{t.actionImageToWord}</h3>
          <p className="vox-card-desc">{t.actionImageToWordDesc}</p>
        </div>
        <div className="vox-card-arrow-row">
          <div className="vox-card-arrow arrow-word">
            <ArrowIcon size={18} />
          </div>
        </div>
      </div>

      {/* 4. Image to Excel */}
      <div
        className="vox-card card-excel"
        onClick={onSelectExcel}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectExcel()}
      >
        <div className="vox-card-header">
          <div className="vox-card-icon-pill icon-excel">
            <FileSpreadsheet size={24} />
          </div>
          <div className="vox-wave-decoration wave-excel">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
        <div className="vox-card-body">
          <h3 className="vox-card-title">{t.actionImageToExcel}</h3>
          <p className="vox-card-desc">{t.actionImageToExcelDesc}</p>
        </div>
        <div className="vox-card-arrow-row">
          <div className="vox-card-arrow arrow-excel">
            <ArrowIcon size={18} />
          </div>
        </div>
      </div>
    </div>
  );
};
