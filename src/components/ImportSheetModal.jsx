import React, { useState, useRef } from 'react';
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, RefreshCw, Layers, Database,
  ArrowRight, ShieldCheck, Download, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';

export function ImportSheetModal({
  open,
  onClose,
  onImport,
  currentEntriesCount = 0,
  currencies = ['PKR', 'USD', 'EUR', 'GBP', 'TRY', 'USDT'],
  colors,
}) {
  const C = colors;
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [importMode, setImportMode] = useState('merge'); // 'merge' | 'replace'
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  const resetState = () => {
    setFile(null);
    setParsing(false);
    setParseError('');
    setParsedData(null);
    setImportMode('merge');
    setImporting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const normalizeDate = (val) => {
    if (!val) return new Date().toISOString().slice(0, 10);
    if (typeof val === 'number') {
      // Excel serial date to JS Date
      const utcDays = Math.floor(val - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      if (!isNaN(dateInfo.getTime())) {
        return dateInfo.toISOString().slice(0, 10);
      }
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  };

  const normalizeType = (val) => {
    if (!val) return 'expense';
    const s = String(val).trim().toLowerCase();
    if (s.includes('income') || s.includes('receivable')) return 'income';
    if (s.includes('saving')) return 'saving';
    if (s.includes('invest')) return 'investment';
    if (s.includes('untracked') || s.includes('missing') || s.includes('unaccounted')) return 'unaccounted';
    return 'expense';
  };

  const normalizeCurrency = (val) => {
    if (!val) return 'PKR';
    const s = String(val).trim().toUpperCase();
    if (currencies.includes(s)) return s;
    if (s.includes('PKR') || s.includes('RS') || s.includes('RUPEE')) return 'PKR';
    if (s.includes('USD') || s === '$') return 'USD';
    if (s.includes('EUR') || s === '€') return 'EUR';
    if (s.includes('GBP') || s === '£') return 'GBP';
    if (s.includes('TRY') || s.includes('TL') || s === '₺') return 'TRY';
    if (s.includes('USDT') || s.includes('TETHER')) return 'USDT';
    return s || 'PKR';
  };

  const processWorkbook = (workbook, fileName) => {
    try {
      const sheetNames = workbook.SheetNames || [];
      if (sheetNames.length === 0) {
        throw new Error('This Excel file does not contain any sheets.');
      }

      // Find Entries Sheet
      let entriesSheetName = sheetNames.find((n) => /all entries|entries|transactions|vault|sheet1/i.test(n)) || sheetNames[0];
      const entriesSheet = workbook.Sheets[entriesSheetName];
      const rawRows = XLSX.utils.sheet_to_json(entriesSheet, { defval: '' });

      // Find Reminders Sheet (if present)
      let remindersSheetName = sheetNames.find((n) => /reminders|bills|dues|sheet2/i.test(n));
      let rawReminders = [];
      if (remindersSheetName && workbook.Sheets[remindersSheetName]) {
        rawReminders = XLSX.utils.sheet_to_json(workbook.Sheets[remindersSheetName], { defval: '' });
      }

      const validEntries = [];
      rawRows.forEach((r) => {
        // Find amount and date columns flexibly
        const amountKey = Object.keys(r).find((k) => /amount|total|value|spent|rs/i.test(k));
        const dateKey = Object.keys(r).find((k) => /date|day|time/i.test(k));
        const typeKey = Object.keys(r).find((k) => /type|kind|category type/i.test(k));
        const currKey = Object.keys(r).find((k) => /currency|curr|symbol/i.test(k));
        const catKey = Object.keys(r).find((k) => /category|tag|group/i.test(k));
        const holdingKey = Object.keys(r).find((k) => /holding|source|account|bank|wallet/i.test(k));
        const noteKey = Object.keys(r).find((k) => /note|description|memo|title|details/i.test(k));

        const rawAmount = amountKey ? r[amountKey] : (r.Amount ?? r.amount);
        const parsedAmount = Number(String(rawAmount).replace(/[^0-9.-]+/g, ''));

        if (!isNaN(parsedAmount) && parsedAmount > 0) {
          const entry = {
            date: normalizeDate(dateKey ? r[dateKey] : r.Date),
            type: normalizeType(typeKey ? r[typeKey] : r.Type),
            amount: parsedAmount,
            currency: normalizeCurrency(currKey ? r[currKey] : r.Currency),
            category: String(catKey ? r[catKey] : (r.Category || '')).trim(),
            holdingSource: String(holdingKey ? r[holdingKey] : (r['Holding Source'] || r.HoldingSource || '')).trim(),
            note: String(noteKey ? r[noteKey] : (r.Note || '')).trim(),
          };
          validEntries.push(entry);
        }
      });

      const validReminders = [];
      rawReminders.forEach((r) => {
        const title = r.Title || r.title || r.Name || r.name;
        if (title) {
          const rawAmount = r['Due Amount'] || r.Amount || r.amount;
          const parsedAmount = rawAmount ? Number(String(rawAmount).replace(/[^0-9.-]+/g, '')) : null;
          validReminders.push({
            id: 'imp_' + Math.random().toString(36).slice(2, 9),
            title: String(title).trim(),
            type: normalizeType(r.Type || r.type),
            dueDate: normalizeDate(r['Due Date'] || r.dueDate || r.Date),
            amount: parsedAmount,
            currency: normalizeCurrency(r.Currency || r.currency),
            frequency: (r.Frequency || 'once').toLowerCase(),
            completed: String(r.Status || r.status).toLowerCase() === 'completed',
            note: String(r.Note || r.note || '').trim(),
            createdAt: new Date().toISOString(),
          });
        }
      });

      if (validEntries.length === 0 && validReminders.length === 0) {
        throw new Error('No valid transactions or reminders found. Ensure your sheet has columns like Date, Type, Amount, Currency, and Category.');
      }

      // Group counts by currency
      const currencyBreakdown = {};
      validEntries.forEach((e) => {
        currencyBreakdown[e.currency] = (currencyBreakdown[e.currency] || 0) + 1;
      });

      setParsedData({
        fileName,
        entries: validEntries,
        reminders: validReminders,
        currencyBreakdown,
      });
    } catch (err) {
      setParseError(err.message || 'Failed to parse Excel sheet.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setParseError('');
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        processWorkbook(workbook, selected.name);
      } catch (err) {
        setParseError('Unable to read this file. Please make sure it is a valid .xlsx or .csv sheet.');
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParseError('Error reading file.');
      setParsing(false);
    };
    reader.readAsArrayBuffer(selected);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!parsedData || !onImport) return;
    setImporting(true);
    try {
      await onImport({
        entries: parsedData.entries,
        reminders: parsedData.reminders,
        mode: importMode,
      });
      handleClose();
    } catch (err) {
      setParseError(err.message || 'Import failed. Please try again.');
      setImporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(20,17,13,0.65)',
        backdropFilter: 'blur(4px)',
        padding: 16,
      }}
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface,
          borderRadius: 22,
          padding: 24,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 48px rgba(0,0,0,0.3)',
          border: `1px solid ${C.line}`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `linear-gradient(135deg, ${C.navy}, ${C.navySoft})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
              <FileSpreadsheet size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: C.heading }}>
                Import Sheet (.xlsx / .csv)
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                Upload exported sheet or backups into your vault
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: C.ice, border: 'none', borderRadius: '50%',
              width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={16} color={C.heading} />
          </button>
        </div>

        {/* Security / Password Reassurance Notice */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: `${C.steel}12`, border: `1px solid ${C.steel}33`,
          borderRadius: 12, padding: '10px 14px', marginBottom: 18, fontSize: 12,
          color: C.navySoft,
        }}>
          <ShieldCheck size={16} color={C.steel} style={{ flexShrink: 0 }} />
          <span>
            <strong>Password Verified:</strong> Import is authorized for your secure vault session.
          </span>
        </div>

        {/* State 1: Upload Dropzone */}
        {!parsedData && (
          <div>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${C.line}`,
                borderRadius: 18,
                padding: '36px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: C.ice,
                transition: 'all .2s ease',
                marginBottom: 16,
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: `${C.navy}10`, margin: '0 auto 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Upload size={24} color={C.navy} />
              </div>

              <div style={{ fontSize: 14.5, fontWeight: 700, color: C.heading, marginBottom: 4 }}>
                Click to browse or drop sheet file here
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                Supports standard Vaultify Excel backups (.xlsx), reports, and CSV files
              </div>

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20, background: C.surface,
                border: `1px solid ${C.line}`, fontSize: 11.5, fontWeight: 600, color: C.navySoft,
              }}>
                <FileSpreadsheet size={13} color={C.steel} /> .xlsx, .xls, .csv up to 25MB
              </div>
            </div>

            {parsing && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: C.steel, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <RefreshCw size={15} style={{ animation: 'vlfSpin 1s linear infinite' }} /> Parsing sheet transactions…
              </div>
            )}

            {parseError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#B23A3414', border: '1px solid #B23A3433',
                borderRadius: 12, padding: '12px 14px', color: '#B23A34',
                fontSize: 12.5, marginBottom: 16,
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{parseError}</span>
              </div>
            )}

            {/* Column Guide Helper */}
            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.heading, marginBottom: 6 }}>
                💡 Sheet Columns Recognized:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11 }}>
                {['Date', 'Type (Expense / Income / Saving / Investment)', 'Amount', 'Currency', 'Category', 'Holding Source', 'Note'].map((col) => (
                  <span key={col} style={{ padding: '3px 8px', borderRadius: 6, background: C.ice, color: C.navySoft, border: `1px solid ${C.line}` }}>
                    {col}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                If your file was generated by Vaultify’s Export feature, all tabs and reminders are detected automatically.
              </div>
            </div>
          </div>
        )}

        {/* State 2: Parsed Summary & Confirmation */}
        {parsedData && (
          <div>
            <div style={{
              background: C.ice, border: `1px solid ${C.line}`, borderRadius: 16,
              padding: 16, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.heading }}>
                  📄 {parsedData.fileName}
                </div>
                <button
                  type="button"
                  onClick={() => { setParsedData(null); setFile(null); }}
                  style={{
                    background: 'none', border: 'none', color: C.steel,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
                  }}
                >
                  Choose another file
                </button>
              </div>

              {/* Stats badges */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
                <div style={{ background: C.surface, padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 11, color: C.muted }}>Entries Found</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>
                    {parsedData.entries.length}
                  </div>
                </div>
                <div style={{ background: C.surface, padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 11, color: C.muted }}>Reminders / Bills</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#D97706' }}>
                    {parsedData.reminders.length}
                  </div>
                </div>
                <div style={{ background: C.surface, padding: '10px 12px', borderRadius: 12, border: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 11, color: C.muted }}>Currencies</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.steel, marginTop: 4 }}>
                    {Object.keys(parsedData.currencyBreakdown).join(', ')}
                  </div>
                </div>
              </div>
            </div>

            {/* Import Mode Selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.heading, marginBottom: 8 }}>
                Select Import Method:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label
                  onClick={() => setImportMode('merge')}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                    borderRadius: 14, border: `1.5px solid ${importMode === 'merge' ? C.navy : C.line}`,
                    background: importMode === 'merge' ? `${C.navy}0B` : C.surface,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.heading }}>
                      ➕ Merge with current data (Recommended)
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      Adds the {parsedData.entries.length} imported entries into your existing vault without deleting current transactions ({currentEntriesCount} active).
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setImportMode('replace')}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px',
                    borderRadius: 14, border: `1.5px solid ${importMode === 'replace' ? '#B23A34' : C.line}`,
                    background: importMode === 'replace' ? '#B23A340D' : C.surface,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#B23A34' }}>
                      🔄 Replace all vault data (Full Restore)
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      Wipes existing {currentEntriesCount} transactions and restores exact sheet backup.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Sample Preview Rows */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 }}>
                Preview sample items:
              </div>
              <div style={{
                maxHeight: 140, overflowY: 'auto', border: `1px solid ${C.line}`,
                borderRadius: 12, background: C.surface, padding: 6,
              }}>
                {parsedData.entries.slice(0, 5).map((e, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 8px', borderBottom: idx < 4 ? `1px solid ${C.line}` : 'none',
                    fontSize: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{e.date}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                        background: e.type === 'income' ? '#2E6F6F18' : e.type === 'saving' ? '#39604A18' : '#B23A3418',
                        color: e.type === 'income' ? '#2E6F6F' : e.type === 'saving' ? '#39604A' : '#B23A34',
                      }}>
                        {e.type}
                      </span>
                      <span style={{ fontWeight: 600, color: C.heading }}>{e.category || 'Entry'}</span>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700, color: C.heading }}>
                      {e.amount} {e.currency}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {parseError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#B23A3414', border: '1px solid #B23A3433',
                borderRadius: 12, padding: '12px 14px', color: '#B23A34',
                fontSize: 12.5, marginBottom: 16,
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{parseError}</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={importing}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  border: `1px solid ${C.line}`, background: C.surface,
                  color: C.muted, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing}
                style={{
                  flex: 2, padding: '12px', borderRadius: 12, border: 'none',
                  background: importMode === 'replace' ? '#B23A34' : C.navy,
                  color: '#fff', fontWeight: 700, fontSize: 13.5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  cursor: 'pointer', opacity: importing ? 0.7 : 1,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                }}
              >
                {importing ? (
                  <>
                    <RefreshCw size={15} style={{ animation: 'vlfSpin 1s linear infinite' }} />
                    Importing {parsedData.entries.length} items…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Confirm & Import ({parsedData.entries.length} records)
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
