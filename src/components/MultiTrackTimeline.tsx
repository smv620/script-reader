import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Headphones,
  Download,
  Layers,
  Sparkles,
  Smile,
  FileText,
  Clock,
  Play,
  Pause,
} from 'lucide-react';
import { RenderedAudioStem, SpeakerProfile, DialogueProject } from '../types/dialogue';

interface MultiTrackTimelineProps {
  project: DialogueProject;
  currentTimeSec: number;
  onSeek: (timeSec: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onDownloadStem: (stem: RenderedAudioStem) => void;
  onDownloadMaster: () => void;
  stemMuteState: Record<string, boolean>;
  onToggleStemMute: (speakerId: string) => void;
  stemSoloState: Record<string, boolean>;
  onToggleStemSolo: (speakerId: string) => void;
  stemVolumeState: Record<string, number>;
  onChangeStemVolume: (speakerId: string, volume: number) => void;
}

export const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = ({
  project,
  currentTimeSec,
  onSeek,
  isPlaying,
  onPlayToggle,
  onDownloadStem,
  onDownloadMaster,
  stemMuteState,
  onToggleStemMute,
  stemSoloState,
  onToggleStemSolo,
  stemVolumeState,
  onChangeStemVolume,
}) => {
  const totalDuration = project.totalDurationSec || 0;
  const hasStems = project.stems && project.stems.length > 0;

  // Zoom scale: pixels per second
  const [zoomLevel, setZoomLevel] = useState<number>(40); // 40px per second

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalDuration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetTime = Math.max(0, Math.min(totalDuration, clickX / zoomLevel));
    onSeek(targetTime);
  };

  // Generate tick markers
  const tickIntervalSec = totalDuration > 60 ? 5 : totalDuration > 20 ? 2 : 1;
  const ticksCount = Math.ceil(totalDuration / tickIntervalSec);
  const timelineWidthPx = Math.max(800, totalDuration * zoomLevel);

  return (
    <div id="timeline-section" className="bg-[#111726] border border-[#1e293b] rounded-xl p-5 mb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e293b]">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Synchronized Multi-Track Timeline & DAW Stems</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Sample-accurate silence pads align all channels. Layer these MP3s into Audacity at time 0:00 for instant synced dialogue.
          </p>
        </div>

        {hasStems && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5 bg-[#0b0f17] border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-400">
              <span className="text-[11px]">Zoom:</span>
              <button
                onClick={() => setZoomLevel((z) => Math.max(20, z - 10))}
                className="px-1.5 py-0.5 rounded hover:bg-slate-800 hover:text-white"
              >
                -
              </button>
              <span className="font-mono text-[11px] text-slate-300">{zoomLevel}px/s</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(100, z + 10))}
                className="px-1.5 py-0.5 rounded hover:bg-slate-800 hover:text-white"
              >
                +
              </button>
            </div>

            <button
              onClick={onDownloadMaster}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Combined Master MP3</span>
            </button>
          </div>
        )}
      </div>

      {!hasStems ? (
        /* Zero state before synthesis */
        <div className="my-8 text-center py-12 px-4 rounded-xl border border-dashed border-slate-800 bg-[#0b0f17]/60">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Timeline Stems Ready for Generation</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Click <strong>"Generate Synced Tracks"</strong> in the top header. The engine will synthesize each character's voice and insert sample-accurate silence pads with optional ambient distraction Foley.
          </p>
          <div className="inline-flex items-center gap-3 text-xs text-slate-400 bg-slate-900/80 px-4 py-2 rounded-lg border border-slate-800">
            <span>{project.speakers.length} Speakers</span>
            <span>·</span>
            <span>{project.lines.length} Dialogue Lines</span>
            <span>·</span>
            <span>{project.ambientConfig.density} Ambient Distractions</span>
          </div>
        </div>
      ) : (
        /* Multi-Track DAW Timeline */
        <div className="pt-4 space-y-4">
          {/* Timeline Container with horizontal scroll */}
          <div className="overflow-x-auto border border-[#1e293b] rounded-lg bg-[#0b0f17]">
            <div style={{ width: `${timelineWidthPx + 240}px` }}>
              {/* Time Ruler */}
              <div className="flex border-b border-[#1e293b] bg-[#0d121d] sticky top-0 z-20">
                {/* Channel Labels Column */}
                <div className="w-[240px] shrink-0 p-2 text-xs font-semibold text-slate-400 border-r border-[#1e293b] flex items-center justify-between">
                  <span>Track Channels</span>
                  <span className="font-mono text-[11px] text-indigo-400 tabular-nums">
                    {currentTimeSec.toFixed(1)}s / {totalDuration.toFixed(1)}s
                  </span>
                </div>

                {/* Ruler Ticks */}
                <div
                  className="relative h-7 cursor-pointer select-none grow"
                  onClick={handleTimelineClick}
                >
                  {Array.from({ length: ticksCount + 1 }).map((_, i) => {
                    const sec = i * tickIntervalSec;
                    if (sec > totalDuration) return null;
                    const left = sec * zoomLevel;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-slate-800/80 flex flex-col justify-between pl-1"
                        style={{ left: `${left}px` }}
                      >
                        <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                          {sec.toFixed(0)}s
                        </span>
                        <div className="w-1 h-1.5 bg-slate-700" />
                      </div>
                    );
                  })}

                  {/* Playhead Marker on ruler */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30"
                    style={{ left: `${currentTimeSec * zoomLevel}px` }}
                  >
                    <div className="w-2.5 h-2.5 bg-rose-500 -ml-1 rotate-45" />
                  </div>
                </div>
              </div>

              {/* Speaker Stem Tracks */}
              {project.stems.map((stem) => {
                const speaker = project.speakers.find((s) => s.id === stem.speakerId) || project.speakers[0];
                const isMuted = stemMuteState[stem.speakerId] || false;
                const isSolo = stemSoloState[stem.speakerId] || false;
                const volume = stemVolumeState[stem.speakerId] ?? 1.0;

                return (
                  <div
                    key={stem.speakerId}
                    className="flex border-b border-[#1e293b] hover:bg-slate-900/30 transition-colors"
                  >
                    {/* Track Control Header Strip */}
                    <div className="w-[240px] shrink-0 p-3 bg-[#0d131f] border-r border-[#1e293b] flex flex-col justify-between">
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: speaker.color }}
                          />
                          <span className="text-xs font-bold text-slate-200 truncate">{stem.speakerName}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {speaker.voiceName}
                        </span>
                      </div>

                      {/* Solo, Mute & Download */}
                      <div className="flex items-center justify-between gap-1 mt-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onToggleStemSolo(stem.speakerId)}
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              isSolo
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                            title="Solo this track"
                          >
                            S
                          </button>
                          <button
                            onClick={() => onToggleStemMute(stem.speakerId)}
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              isMuted
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                            title="Mute this track"
                          >
                            M
                          </button>
                        </div>

                        {/* Volume fader */}
                        <input
                          type="range"
                          min="0"
                          max="1.5"
                          step="0.05"
                          value={volume}
                          onChange={(e) => onChangeStemVolume(stem.speakerId, parseFloat(e.target.value))}
                          className="w-16 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
                          title={`Track Gain: ${Math.round(volume * 100)}%`}
                        />

                        {/* Download MP3 button */}
                        <button
                          onClick={() => onDownloadStem(stem)}
                          className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 border border-indigo-500/30"
                          title="Download synchronized MP3 with exact silence padding for Audacity"
                        >
                          <Download className="w-3 h-3" />
                          <span>MP3</span>
                        </button>
                      </div>
                    </div>

                    {/* Track Lane Blocks */}
                    <div
                      className="relative h-20 grow cursor-pointer select-none bg-[#090d15]"
                      onClick={handleTimelineClick}
                    >
                      {/* Playhead vertical line through lane */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-500/70 z-20 pointer-events-none"
                        style={{ left: `${currentTimeSec * zoomLevel}px` }}
                      />

                      {/* Render Speech Blocks and Silence Intervals */}
                      {stem.segments.map((seg, sIdx) => {
                        const left = seg.startSec * zoomLevel;
                        const width = Math.max(8, (seg.endSec - seg.startSec) * zoomLevel);

                        if (seg.isSpeech) {
                          return (
                            <div
                              key={sIdx}
                              className="absolute top-2 bottom-2 rounded-md p-1.5 overflow-hidden flex flex-col justify-between border shadow-sm transition-transform hover:scale-[1.01]"
                              style={{
                                left: `${left}px`,
                                width: `${width}px`,
                                backgroundColor: `${speaker.color}33`,
                                borderColor: `${speaker.color}88`,
                              }}
                              title={`Speech (${(seg.endSec - seg.startSec).toFixed(1)}s): "${seg.text}"`}
                            >
                              <div className="flex items-center justify-between text-[10px] text-white font-semibold truncate">
                                <span className="truncate">{seg.text}</span>
                              </div>
                              <div className="text-[9px] font-mono text-slate-300 tabular-nums">
                                {seg.startSec.toFixed(1)}s - {seg.endSec.toFixed(1)}s
                              </div>
                            </div>
                          );
                        } else {
                          // Silence interval or Ambient Foley
                          return (
                            <div
                              key={sIdx}
                              className={`absolute top-3 bottom-3 rounded border border-dashed flex items-center justify-center overflow-hidden ${
                                seg.ambientEvent
                                  ? 'bg-emerald-950/20 border-emerald-500/40'
                                  : 'bg-slate-900/40 border-slate-800'
                              }`}
                              style={{
                                left: `${left}px`,
                                width: `${width}px`,
                              }}
                              title={
                                seg.ambientEvent
                                  ? `Ambient Foley (${seg.ambientEvent}): ${(seg.endSec - seg.startSec).toFixed(1)}s`
                                  : `Silence pad: ${(seg.endSec - seg.startSec).toFixed(1)}s`
                              }
                            >
                              {seg.ambientEvent ? (
                                <span className="text-[10px] font-medium text-emerald-400 px-1 truncate flex items-center gap-1">
                                  <span>
                                    {seg.ambientEvent === 'paper_shuffle'
                                      ? '📄'
                                      : seg.ambientEvent === 'sniff'
                                      ? '🤧'
                                      : seg.ambientEvent === 'cough'
                                      ? '😷'
                                      : seg.ambientEvent === 'chuckle' || seg.ambientEvent === 'giggle'
                                      ? '😄'
                                      : '😮‍💨'}
                                  </span>
                                  <span className="truncate capitalize">{seg.ambientEvent.replace('_', ' ')}</span>
                                </span>
                              ) : (
                                width > 45 && (
                                  <span className="text-[9px] font-mono text-slate-400 truncate">
                                    [Silence]
                                  </span>
                                )
                              )}
                            </div>
                          );
                        }
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audacity Drag & Drop Helper Note */}
          <div className="p-3 bg-[#0d131f] border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Audacity Workflow:</strong> Each downloaded speaker MP3 has identical duration (
                <span className="font-mono text-slate-200 tabular-nums">{totalDuration.toFixed(2)}s</span>). Simply drag both/all files into Audacity at 0:00.000 — they will speak together in perfect harmony with zero manual editing.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
