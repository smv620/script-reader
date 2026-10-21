import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Sparkles,
  Link2,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Loader2,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { TranscriptValidationResult } from '../types/dialogue';
import { validateAndParseTranscript } from '../services/transcriptParser';

interface TranscriptUploaderProps {
  onValidated: (result: TranscriptValidationResult) => void;
}

export const TranscriptUploader: React.FC<TranscriptUploaderProps> = ({ onValidated }) => {
  const [activeTab, setActiveTab] = useState<'drive' | 'upload' | 'paste'>('drive');
  const [driveUrl, setDriveUrl] = useState('');
  const [isFetchingDrive, setIsFetchingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const [pasteText, setPasteText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleProcessText = (text: string, name?: string) => {
    if (!text.trim()) return;
    const result = validateAndParseTranscript(text, name);
    onValidated(result);
  };

  // Google Drive Link Handler
  const handleFetchDriveLink = async () => {
    if (!driveUrl.trim()) {
      setDriveError('Please enter a Google Drive or Google Docs URL.');
      return;
    }

    setIsFetchingDrive(true);
    setDriveError(null);

    try {
      const res = await fetch('/api/drive/fetch-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: driveUrl }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch transcript from Google Drive link');
      }

      setFileName(data.title || 'Google Drive Transcript');
      handleProcessText(data.text, data.title || 'Google Drive Transcript');
    } catch (err: any) {
      console.error('Google Drive fetch error:', err);
      setDriveError(err.message || 'Error accessing Google Drive document.');
    } finally {
      setIsFetchingDrive(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPasteText(content);
      handleProcessText(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setPasteText(content);
        handleProcessText(content, file.name);
      };
      reader.readAsText(file);
    }
  };

  // Preset generator matching exact user example
  const loadExactPromptExample = () => {
    const lines: string[] = [];
    lines.push('// === SESSION 14: THE SUNKEN CATACOMBS ===');
    lines.push('# Campaign log prepared by game recorder');
    lines.push('/* Background ambiance: dripping stone and faint wind */');

    let dmCount = 0;
    let maiahCount = 0;
    let antonCount = 0;
    let commentCount = 3;

    for (let round = 1; round <= 42; round++) {
      if (dmCount < 42) {
        dmCount++;
        lines.push(`DM: The torchlight flickers along the cold granite walls as shadows lengthen in chamber ${dmCount}.`);
      }
      if (maiahCount < 37) {
        maiahCount++;
        lines.push(`Maiah: I keep my daggers drawn and step lightly across the flagstones, checking for tripwires.`);
      }
      if (antonCount < 15) {
        antonCount++;
        lines.push(`Anton: My warhammer is thirsty for goblin blood! Stand aside, elf!`);
      }

      if (commentCount < 30) {
        commentCount++;
        if (commentCount % 3 === 0) {
          lines.push(`[Dice Roll: Maiah rolls Perception check, gets 19]`);
        } else if (commentCount % 3 === 1) {
          lines.push(`// Note: Players agree to take a short rest after this encounter`);
        } else {
          lines.push(`[SFX: Heavy stone doorway grinding open in the distance]`);
        }
      }
    }

    while (commentCount < 30) {
      commentCount++;
      lines.push(`// Rule note #${commentCount}: Invisibility grants advantage`);
    }

    const sampleScript = lines.join('\n');
    setPasteText(sampleScript);
    setFileName('campaign_session_14.txt');
    handleProcessText(sampleScript, 'campaign_session_14.txt');
  };

  return (
    <div className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e293b]">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>Script Import & Speaker Discovery</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Import from Google Drive, upload files, or paste raw text. The system automatically tallies speakers and speaking lines, detects comments to ignore, and matches saved voice personas.
          </p>
        </div>

        <button
          onClick={loadExactPromptExample}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors whitespace-nowrap self-start sm:self-auto"
          title="Loads the 3-speaker example: DM (42), Maiah (37), Anton (15) with 30 comments"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Load 3-Speaker D&D Sample</span>
        </button>
      </div>

      {/* Input Mode Selector Tabs */}
      <div className="flex items-center gap-2 pt-4 pb-3">
        <button
          onClick={() => setActiveTab('drive')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
            activeTab === 'drive'
              ? 'bg-[#1b253b] text-white border-indigo-500 shadow-sm'
              : 'bg-[#0f1422] text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <Link2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>Google Drive Link</span>
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
            activeTab === 'upload'
              ? 'bg-[#1b253b] text-white border-indigo-500 shadow-sm'
              : 'bg-[#0f1422] text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span>Upload File</span>
        </button>

        <button
          onClick={() => setActiveTab('paste')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
            activeTab === 'paste'
              ? 'bg-[#1b253b] text-white border-indigo-500 shadow-sm'
              : 'bg-[#0f1422] text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-3.5 h-3.5 text-amber-400" />
          <span>Paste Text</span>
        </button>
      </div>

      {/* Tab 1: Google Drive Link Import */}
      {activeTab === 'drive' && (
        <div className="bg-[#0b0f17] border border-[#1e293b] rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Google Drive or Google Docs Sharing Link
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative grow">
                <Link2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="url"
                  value={driveUrl}
                  onChange={(e) => {
                    setDriveUrl(e.target.value);
                    if (driveError) setDriveError(null);
                  }}
                  placeholder="https://docs.google.com/document/d/... or https://drive.google.com/file/d/..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#151c2c] border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <button
                onClick={handleFetchDriveLink}
                disabled={isFetchingDrive || !driveUrl.trim()}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white shadow-sm transition-all whitespace-nowrap"
              >
                {isFetchingDrive ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Fetching Link...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" />
                    <span>Import from Google Drive</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Drive Error Banner */}
          {driveError && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs rounded-lg flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Access Note: </span>
                <span>{driveError}</span>
              </div>
            </div>
          )}

          {/* Drive Helper Tips */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>
              Supported: Google Docs (<code className="text-slate-300">/document/d/...</code>) and Google Drive files (<code className="text-slate-300">/file/d/...</code>) set to "Anyone with the link can view".
            </span>

            {/* Quick Demo Fill button */}
            <button
              type="button"
              onClick={() => {
                setDriveUrl('https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit');
              }}
              className="text-indigo-400 hover:underline shrink-0 text-left sm:text-right"
            >
              Insert demo doc URL
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: File Upload (.txt, .md, .srt, .vtt) */}
      {activeTab === 'upload' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-950/20'
              : 'border-slate-800 bg-[#0b0f17] hover:border-slate-700 hover:bg-[#0f1422]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".txt,.md,.srt,.vtt,.csv,.json"
            className="hidden"
          />
          <FileText className="w-8 h-8 text-indigo-400 mb-2" />
          <span className="text-xs font-bold text-slate-200">
            {fileName ? fileName : 'Upload Script (.txt, .md, .srt, .vtt)'}
          </span>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
            Drag and drop your file here, or click to browse. Automatically reformats lines and strips comments.
          </p>
        </div>
      )}

      {/* Tab 3: Paste Text */}
      {activeTab === 'paste' && (
        <div className="flex flex-col space-y-2 bg-[#0b0f17] border border-[#1e293b] rounded-lg p-3">
          <textarea
            rows={6}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste dialogue script directly here... (e.g. DM: Welcome adventurers... / Maiah: I check for traps...)"
            className="w-full px-3 py-2 text-xs bg-[#131926] border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-mono">
              {pasteText.split('\n').filter((l) => l.trim().length > 0).length} raw lines typed
            </span>

            <button
              onClick={() => handleProcessText(pasteText, fileName || 'pasted_transcript.txt')}
              disabled={!pasteText.trim()}
              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors"
            >
              Validate & Verify Script
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
