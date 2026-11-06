import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useReducer, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../components/ui/icon-button';
import { SegmentedControl } from '../../components/ui/segmented-control';
import './pdf-paper-panel.css';

const paperModes = ['reading', 'translation', 'principles'] as const;
type PaperMode = (typeof paperModes)[number];

const paperTasks = {
  reading: ['explain', 'decompose', 'challenge', 'connect'],
  translation: ['translateSelection', 'translateAbstract'],
  principles: ['intuition', 'steps', 'derivation'],
} as const;
type PaperTask = (typeof paperTasks)[PaperMode][number];

const perspectives = ['general', 'practical', 'algorithm', 'domain'] as const;
type PaperPerspective = (typeof perspectives)[number];
type TranslationStyle = 'faithful' | 'academic';

type PaperPanelState = {
  mode: PaperMode;
  perspective: PaperPerspective;
  translationStyle: TranslationStyle;
  domain: string;
};

type PaperPanelEvent =
  | { type: 'modeChosen'; mode: PaperMode }
  | { type: 'perspectiveChosen'; perspective: PaperPerspective }
  | { type: 'translationStyleChosen'; translationStyle: TranslationStyle }
  | { type: 'domainEdited'; domain: string };

function paperPanelReducer(state: PaperPanelState, event: PaperPanelEvent): PaperPanelState {
  switch (event.type) {
    case 'modeChosen':
      return { ...state, mode: event.mode };
    case 'perspectiveChosen':
      return { ...state, perspective: event.perspective };
    case 'translationStyleChosen':
      return { ...state, translationStyle: event.translationStyle };
    case 'domainEdited':
      return { ...state, domain: event.domain };
  }
}

export type PdfPaperPanelProps = {
  selectedQuote?: string;
  hasSelection: boolean;
  busy: boolean;
  showingResults: boolean;
  notes: ReactNode;
  results: ReactNode;
  onShowResults: (show: boolean) => void;
  onRunTask: (prompt: string) => void;
  onClose: () => void;
  onOpenSettings?: () => void;
};

export function PdfPaperPanel({
  selectedQuote,
  hasSelection,
  busy,
  showingResults,
  notes,
  results,
  onShowResults,
  onRunTask,
  onClose,
  onOpenSettings,
}: PdfPaperPanelProps) {
  const { t } = useTranslation();
  const [{ mode, perspective, translationStyle, domain }, dispatch] = useReducer(
    paperPanelReducer,
    {
      mode: 'reading',
      perspective: 'general',
      translationStyle: 'faithful',
      domain: '',
    },
  );
  const translating = mode === 'translation';
  const domainRequired = !translating && perspective === 'domain';
  const domainName = domain.trim();
  const canRun = hasSelection && !busy && (!domainRequired || Boolean(domainName));

  function runTask(task: PaperTask) {
    const instruction = translating
      ? t(`pdfPaper.prompts.${translationStyle}`)
      : t(`pdfPaper.prompts.${perspective}`);
    const focus =
      (translating || domainRequired) && domainName
        ? t('pdfPaper.prompts.field', { domain: domainName })
        : '';
    const guidance = translating ? 'translation' : 'analysis';
    onRunTask(
      [t(`pdfPaper.prompts.${task}`), instruction, focus, t(`pdfPaper.prompts.${guidance}`)]
        .filter(Boolean)
        .join('\n\n'),
    );
  }

  return (
    <aside className="pdf-paper-panel" aria-label={t('pdfPaper.title')}>
      <header className="pdf-paper-header">
        <h2>{t('pdfPaper.title')}</h2>
        <div className="pdf-paper-header-actions">
          {onOpenSettings ? (
            <button className="pdf-paper-model-settings" type="button" onClick={onOpenSettings}>
              {t('pdfPaper.modelSettings')}
            </button>
          ) : null}
          <IconButton
            aria-label={t('pdfPaper.close')}
            className="pdf-paper-close"
            title={t('pdfPaper.close')}
            onClick={onClose}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={17} aria-hidden="true" />
          </IconButton>
        </div>
      </header>
      <div className="pdf-paper-controls">
        <SegmentedControl
          aria-label={t('pdfPaper.modeLabel')}
          className="pdf-paper-segments"
          options={paperModes.map((value) => ({ value, label: t(`pdfPaper.modes.${value}`) }))}
          value={mode}
          onValueChange={(nextMode) => dispatch({ type: 'modeChosen', mode: nextMode })}
        />
        <div className="pdf-paper-settings">
          {translating ? (
            <label>
              <span>{t('pdfPaper.styleLabel')}</span>
              <select
                value={translationStyle}
                onChange={(event) =>
                  dispatch({
                    type: 'translationStyleChosen',
                    translationStyle:
                      event.currentTarget.value === 'academic' ? 'academic' : 'faithful',
                  })
                }
              >
                <option value="faithful">{t('pdfPaper.faithful')}</option>
                <option value="academic">{t('pdfPaper.academic')}</option>
              </select>
            </label>
          ) : (
            <label>
              <span>{t('pdfPaper.perspectiveLabel')}</span>
              <select
                value={perspective}
                onChange={(event) => {
                  const nextPerspective = perspectives.find(
                    (option) => option === event.currentTarget.value,
                  );
                  if (nextPerspective) {
                    dispatch({ type: 'perspectiveChosen', perspective: nextPerspective });
                  }
                }}
              >
                {perspectives.map((value) => (
                  <option key={value} value={value}>
                    {t(`pdfPaper.perspectives.${value}`)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {translating || domainRequired ? (
            <label>
              <span>{t('pdfPaper.fieldLabel')}</span>
              <input
                maxLength={80}
                placeholder={t('pdfPaper.fieldPlaceholder')}
                required={domainRequired}
                type="text"
                value={domain}
                onChange={(event) =>
                  dispatch({ type: 'domainEdited', domain: event.currentTarget.value })
                }
              />
            </label>
          ) : null}
        </div>
        <div className="pdf-paper-tasks" role="group" aria-label={t('pdfPaper.tasksLabel')}>
          {paperTasks[mode].map((task) => (
            <button key={task} disabled={!canRun} type="button" onClick={() => runTask(task)}>
              {t(`pdfPaper.tasks.${task}`)}
            </button>
          ))}
        </div>
        {selectedQuote ? (
          <blockquote className="pdf-paper-selection" title={selectedQuote}>
            {selectedQuote}
          </blockquote>
        ) : (
          <p className="pdf-paper-selection is-empty">
            {t(translating ? 'pdfPaper.selectTranslationText' : 'pdfPaper.selectText')}
          </p>
        )}
      </div>
      <SegmentedControl
        aria-label={t('pdfPaper.contentLabel')}
        className="pdf-paper-segments pdf-paper-content-switch"
        options={[
          { value: 'notes', label: t('pdfPaper.notes') },
          { value: 'results', label: t('pdfPaper.results') },
        ]}
        value={showingResults ? 'results' : 'notes'}
        onValueChange={(value) => onShowResults(value === 'results')}
      />
      <div className="pdf-paper-content">
        {showingResults ? null : notes}
        <div className="pdf-paper-results" hidden={!showingResults}>
          {results}
        </div>
      </div>
    </aside>
  );
}
