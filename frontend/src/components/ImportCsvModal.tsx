import { useRef, useState, useEffect } from 'react';
import type { CsvPreviewResponse } from '@tc/shared';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import { showConfirm } from './ConfirmModal';

interface ImportCsvModalProps {
  onClose: () => void;
  accountCount: number;
}

type Step = 'pick' | 'map' | 'done';

interface DoneResult {
  accounts_inserted: number;
}

const TC_FIELD_LABELS: Record<string, string> = {
  name: 'Account Name',
  sf_id: 'Salesforce ID',
  industry: 'Industry',
  state: 'State',
  status: 'Status / Type',
  fortune_500: 'Fortune 500',
  fortune_1000: 'Fortune 1000',
  open_opps: 'Open Opps',
  amount: 'Amount',
  website: 'Website',
  linkedin_url: 'LinkedIn URL',
};

const TC_FIELDS = Object.keys(TC_FIELD_LABELS);

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9000,
};

const PANEL_STYLE: React.CSSProperties = {
  background: '#0f1929',
  border: '1px solid #1e3048',
  borderRadius: '0.5rem',
  padding: '1.5rem',
  width: '600px',
  maxWidth: '95vw',
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
};

const BTN_GHOST: React.CSSProperties = {
  background: 'none',
  border: '1px solid #1e3048',
  borderRadius: '0.375rem',
  color: '#9db8cc',
  fontSize: '0.875rem',
  padding: '0.4rem 0.875rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? '#1e3048' : '#00e5a0',
    color: disabled ? '#3a5068' : '#080e1a',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    padding: '0.4rem 0.875rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit',
  };
}

export default function ImportCsvModal({ onClose, accountCount }: ImportCsvModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<CsvPreviewResponse | null>(null);
  const [userMapping, setUserMapping] = useState<Record<string, string | null>>({});
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<DoneResult | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handlePreview() {
    if (!file) return;
    setPreviewing(true);
    try {
      const data = await api.csv.preview(file);
      const initial: Record<string, string | null> = {};
      for (const field of TC_FIELDS) {
        initial[field] = data.mapping.mapping[field] ?? null;
      }
      setPreview(data);
      setUserMapping(initial);
      setStep('map');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'CSV preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCommit() {
    if (!file || !preview) return;

    const confirmed = await showConfirm({
      title: 'Replace all accounts?',
      body: `This will DELETE all ${accountCount} existing accounts and ALL their stakeholders, calls, questions, pains, plans, and gameplans. ${preview.totalRows} new accounts will be imported from the CSV. A SQLite snapshot is created automatically before the wipe. This cannot be undone.`,
      confirmLabel: 'Import',
      destructive: true,
    });
    if (!confirmed) return;

    setCommitting(true);
    try {
      const res = await api.csv.commit(file, userMapping);
      setResult({ accounts_inserted: res.accounts_inserted });
      setStep('done');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setCommitting(false);
    }
  }

  const nameMapped = !!userMapping['name'];

  return (
    <div onClick={onClose} style={OVERLAY_STYLE}>
      <div onClick={e => e.stopPropagation()} style={PANEL_STYLE}>

        {step === 'pick' && (
          <>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#dde6ee', marginBottom: '0.5rem' }}>
              Import Accounts from CSV
            </div>
            <div style={{ fontSize: '0.875rem', color: '#9db8cc', marginBottom: '1.25rem', lineHeight: 1.55 }}>
              Select a Salesforce or CRM account export. Column headers are detected automatically.
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={e => {
                setFile(e.target.files?.[0] ?? null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #1e3048',
                borderRadius: '0.375rem',
                padding: '1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '1.25rem',
                color: file ? '#dde6ee' : '#6b8599',
                fontSize: '0.875rem',
              }}
            >
              {file ? file.name : 'Click to select a .csv file'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
              <button onClick={onClose} style={BTN_GHOST}>Cancel</button>
              <button
                onClick={handlePreview}
                disabled={!file || previewing}
                style={primaryBtn(!file || previewing)}
              >
                {previewing ? 'Loading...' : 'Preview'}
              </button>
            </div>
          </>
        )}

        {step === 'map' && preview && (
          <>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#dde6ee', marginBottom: '0.25rem' }}>
              Map Columns
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#6b8599', marginBottom: '1.25rem' }}>
              {preview.totalRows} rows detected. "Account Name" must be mapped to import.
            </div>

            <div style={{
              border: '1px solid #1e3048',
              borderRadius: '0.375rem',
              marginBottom: '1.25rem',
              overflow: 'hidden',
            }}>
              {TC_FIELDS.map((field, i) => (
                <div
                  key={field}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.4rem 0.75rem',
                    borderBottom: i < TC_FIELDS.length - 1 ? '1px solid #1e3048' : 'none',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#9db8cc',
                    width: '140px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                  }}>
                    {TC_FIELD_LABELS[field]}
                    {field === 'name' && (
                      <span style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        color: '#e06050',
                        border: '1px solid #e06050',
                        borderRadius: '3px',
                        padding: '0 0.25rem',
                      }}>
                        required
                      </span>
                    )}
                  </div>
                  <select
                    value={userMapping[field] ?? ''}
                    onChange={e => setUserMapping(m => ({ ...m, [field]: e.target.value || null }))}
                    style={{
                      flex: 1,
                      background: '#162032',
                      border: '1px solid #1e3048',
                      borderRadius: '0.25rem',
                      color: userMapping[field] ? '#dde6ee' : '#6b8599',
                      fontSize: '0.8rem',
                      padding: '0.3rem 0.5rem',
                      fontFamily: 'inherit',
                    }}
                  >
                    <option value="">(none)</option>
                    {preview.headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.8rem', color: '#6b8599', marginBottom: '0.5rem' }}>
              First {preview.previewRows.length} rows:
            </div>
            <div style={{
              overflowX: 'auto',
              border: '1px solid #1e3048',
              borderRadius: '0.375rem',
              marginBottom: '1.25rem',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', color: '#9db8cc' }}>
                <thead>
                  <tr>
                    {preview.headers.map(h => (
                      <th key={h} style={{
                        padding: '0.35rem 0.5rem',
                        textAlign: 'left',
                        borderBottom: '1px solid #1e3048',
                        color: '#6b8599',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : '#0a1525' }}>
                      {preview.headers.map((_, hi) => (
                        <td key={hi} style={{
                          padding: '0.3rem 0.5rem',
                          whiteSpace: 'nowrap',
                          maxWidth: '180px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {row[hi] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setStep('pick')} style={BTN_GHOST}>Back</button>
              <div style={{ display: 'flex', gap: '0.625rem' }}>
                <button onClick={onClose} style={BTN_GHOST}>Cancel</button>
                <button
                  onClick={handleCommit}
                  disabled={!nameMapped || committing}
                  style={primaryBtn(!nameMapped || committing)}
                >
                  {committing ? 'Importing...' : `Import ${preview.totalRows} rows`}
                </button>
              </div>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <div style={{ fontSize: '0.875rem', color: '#9db8cc', lineHeight: 1.65 }}>
            Imported{' '}
            <span style={{ color: '#00e5a0', fontWeight: 600 }}>{result.accounts_inserted}</span>{' '}
            accounts. Reloading...
          </div>
        )}

      </div>
    </div>
  );
}
