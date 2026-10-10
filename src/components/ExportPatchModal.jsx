import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { openRomWeb } from '../utils/fileHelpers';
import { crc32, formatCrc32, stripCopierHeader } from '../rom/patches';
import { quickValidate } from '../rom/romValidator';
import '../styles/UnsavedModal.css';
import '../styles/ExportPatchModal.css';

const FORMATS = [
  { id: 'bps', labelKey: 'patchFormatBps', descKey: 'patchFormatBpsDesc' },
  { id: 'ips', labelKey: 'patchFormatIps', descKey: 'patchFormatIpsDesc' },
];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default function ExportPatchModal({ visible, onClose }) {
  const { t } = useI18n();
  const { romParser, romInfo, handleExportPatch } = useRom();
  const [format, setFormat] = useState('bps');
  const [customBase, setCustomBase] = useState(null); // { name, data, crc, title }
  const [metadata, setMetadata] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const exportRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setResult(null);
      exportRef.current?.focus();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  // Reset the custom base when another ROM is loaded
  useEffect(() => {
    setCustomBase(null);
  }, [romParser]);

  const loadedCrc = useMemo(() => {
    if (!visible || !romParser) return null;
    return crc32(stripCopierHeader(romParser.getOriginalData()));
  }, [visible, romParser]);

  if (!visible) return null;

  const handlePickBase = async () => {
    const file = await openRomWeb();
    if (!file) return;
    const validation = quickValidate(file.data);
    if (!validation.isValid) {
      setResult({ success: false, error: t('patchBaseInvalid') });
      return;
    }
    setCustomBase({
      name: file.name,
      data: file.data,
      crc: crc32(stripCopierHeader(file.data)),
      title: validation.internalTitle,
    });
    setResult(null);
  };

  const handleExport = async () => {
    setBusy(true);
    setResult(null);
    const res = await handleExportPatch({
      format,
      baseData: customBase?.data,
      metadata: format === 'bps' ? metadata.trim() : '',
    });
    setBusy(false);
    if (res.canceled) return;
    setResult(res);
  };

  const currentTitle = romInfo?.internalTitle;
  const titleMismatch = customBase && currentTitle && customBase.title !== currentTitle;

  const errorText = (err) => (err === 'noChanges' ? t('patchNoChanges') : err);

  return (
    <div className="unsaved-overlay" role="dialog" aria-modal="true" aria-labelledby="patch-title">
      <div className="patch-modal">
        <div className="patch-header">
          <h3 id="patch-title" className="patch-title">
            {t('patchTitle')}
          </h3>
          <p className="patch-subtitle">{t('patchSubtitle')}</p>
        </div>

        <div className="patch-section">
          <div className="patch-label">{t('patchFormat')}</div>
          <div className="patch-formats">
            {FORMATS.map((f) => (
              <label
                key={f.id}
                className={`patch-format ${format === f.id ? 'patch-format-active' : ''}`}
              >
                <input
                  type="radio"
                  name="patch-format"
                  value={f.id}
                  checked={format === f.id}
                  onChange={() => setFormat(f.id)}
                />
                <span className="patch-format-name">{t(f.labelKey)}</span>
                <span className="patch-format-desc">{t(f.descKey)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="patch-section">
          <div className="patch-label">{t('patchBase')}</div>
          <div className="patch-base">
            <div className="patch-base-info">
              <span className="patch-base-name">
                {customBase
                  ? customBase.name
                  : `${romInfo?.fileName || ''} ${t('patchBaseLoaded')}`}
              </span>
              <span className="patch-crc">
                CRC32: {formatCrc32(customBase ? customBase.crc : loadedCrc || 0)}
              </span>
            </div>
            <div className="patch-base-actions">
              <button className="unsaved-btn unsaved-btn-secondary" onClick={handlePickBase}>
                {t('patchBasePick')}
              </button>
              {customBase && (
                <button
                  className="unsaved-btn unsaved-btn-ghost"
                  onClick={() => setCustomBase(null)}
                >
                  {t('patchBaseReset')}
                </button>
              )}
            </div>
          </div>
          <p className="patch-hint">{t('patchBaseHint')}</p>
          {titleMismatch && (
            <p className="patch-warning">
              {t('patchBaseTitleMismatch')} ({customBase.title} / {currentTitle})
            </p>
          )}
        </div>

        {format === 'bps' && (
          <div className="patch-section">
            <label className="patch-label" htmlFor="patch-metadata">
              {t('patchMetadata')}
            </label>
            <textarea
              id="patch-metadata"
              className="patch-metadata"
              rows={2}
              value={metadata}
              placeholder={t('patchMetadataPlaceholder')}
              onChange={(e) => setMetadata(e.target.value)}
            />
          </div>
        )}

        <p className="patch-hint">{t('patchChecksumNote')}</p>

        {result && (
          <div className={result.success ? 'patch-result-ok' : 'patch-result-error'}>
            {result.success ? (
              <>
                <div>{t('patchSuccess')}</div>
                <div className="patch-result-path">{result.path}</div>
                <div className="patch-result-stats">
                  {result.changedBytes} {t('patchChangedBytes')} · {formatSize(result.size)} ·{' '}
                  {t('patchResultCrc')} {formatCrc32(result.targetCrc)}
                </div>
              </>
            ) : (
              errorText(result.error)
            )}
          </div>
        )}

        <div className="unsaved-actions">
          <button
            ref={exportRef}
            className="unsaved-btn unsaved-btn-primary"
            onClick={handleExport}
            disabled={busy || !romParser}
          >
            {busy ? t('patchExporting') : t('patchExport')}
          </button>
          <button className="unsaved-btn unsaved-btn-ghost" onClick={onClose}>
            {t('patchClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
