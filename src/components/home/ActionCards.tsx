import React from 'react';
import { Mic, ScanText, FileType, Table as TableIcon } from 'lucide-react';
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
  const { t } = useTranslation();

  return (
    <div className="actions-grid" role="region" aria-label="Main Actions">
      {/* 1. Speech to Text */}
      <div
        className="action-card"
        onClick={onSelectSpeech}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectSpeech()}
      >
        <div className="action-icon-wrapper action-icon-stt">
          <Mic size={26} />
        </div>
        <h3 className="action-card-title">{t.actionSpeechToText}</h3>
        <p className="action-card-desc">{t.actionSpeechToTextDesc}</p>
      </div>

      {/* 2. Image to Text */}
      <div
        className="action-card"
        onClick={onSelectOcr}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectOcr()}
      >
        <div className="action-icon-wrapper action-icon-ocr">
          <ScanText size={26} />
        </div>
        <h3 className="action-card-title">{t.actionImageToText}</h3>
        <p className="action-card-desc">{t.actionImageToTextDesc}</p>
      </div>

      {/* 3. Image to Word */}
      <div
        className="action-card"
        onClick={onSelectWord}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectWord()}
      >
        <div className="action-icon-wrapper action-icon-word">
          <FileType size={26} />
        </div>
        <h3 className="action-card-title">{t.actionImageToWord}</h3>
        <p className="action-card-desc">{t.actionImageToWordDesc}</p>
      </div>

      {/* 4. Image to Excel */}
      <div
        className="action-card"
        onClick={onSelectExcel}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectExcel()}
      >
        <div className="action-icon-wrapper action-icon-excel">
          <TableIcon size={26} />
        </div>
        <h3 className="action-card-title">{t.actionImageToExcel}</h3>
        <p className="action-card-desc">{t.actionImageToExcelDesc}</p>
      </div>
    </div>
  );
};
