'use client';

import { useCallback, useState } from 'react';
import { useSpeechRecognition, type SpeechState } from '@/lib/voice/useSpeech';
import { parseVoiceCommand, type VoiceAction } from '@/lib/voice/commands';
import { Button } from '@/components/ui';
import { IconMic, IconMicOff, IconAlert, IconCheck } from '@/components/icons';

interface Props {
  /** returns true when a set can be marked done (running, sets left) */
  canLogSet: boolean;
  paused: boolean;
  onPause(): void;
  onResume(): void;
  onNextExercise(): void;
  onSetDone(): void;
  onFinishConfirmed(): void;
}

function stateLabel(s: SpeechState): string | null {
  switch (s.kind) {
    case 'listening': return 'Listening…';
    case 'denied': return 'Microphone permission denied — typed controls remain fully functional.';
    case 'error': return s.message;
    case 'unsupported': return 'Voice input isn’t supported in this browser — use the normal controls.';
    default: return null;
  }
}

/**
 * Voice command centre for the session runner. Consequential actions (ending a
 * workout) ALWAYS require an explicit second confirmation — either saying
 * "confirm" or tapping the confirm button. Success is never claimed until the
 * underlying operation actually ran.
 */
export function VoiceControl({ canLogSet, paused, onPause, onResume, onNextExercise, onSetDone, onFinishConfirmed }: Props) {
  const [heard, setHeard] = useState<string | null>(null);
  const [pendingFinish, setPendingFinish] = useState(false);
  const [lastNote, setLastNote] = useState<string | null>(null);

  const handle = useCallback(
    (raw: string) => {
      setHeard(`“${raw}”`);
      const action: VoiceAction = parseVoiceCommand(raw);

      switch (action.type) {
        case 'confirm_finish':
          if (!pendingFinish) return setLastNote('Nothing to confirm right now.');
          setPendingFinish(false);
          setLastNote('Finishing workout…');
          onFinishConfirmed();
          return;
        case 'cancel':
          if (pendingFinish) {
            setPendingFinish(false);
            setLastNote('Finish cancelled — workout continues.');
          }
          return;
        case 'finish':
          setPendingFinish(true);
          setLastNote('Say “confirm” or tap Confirm to end the workout.');
          return;
        case 'pause':
          if (pendingFinish) return setLastNote('Confirm or cancel the finish first.');
          if (paused) return setLastNote('Already paused.');
          onPause();
          setLastNote('Paused.');
          return;
        case 'resume':
          if (pendingFinish) return setLastNote('Confirm or cancel the finish first.');
          if (!paused) return setLastNote('Already running.');
          onResume();
          setLastNote('Resumed.');
          return;
        case 'next_exercise':
          if (pendingFinish) return setLastNote('Finish is awaiting confirmation.');
          onNextExercise();
          setLastNote('Skipped to next exercise.');
          return;
        case 'set_done':
          if (!canLogSet) return setLastNote('No set to mark right now.');
          onSetDone();
          setLastNote('Set logged.');
          return;
        case 'start':
        case 'navigate':
        case 'log_water':
        case 'read_progress':
          setLastNote('That command is available outside the workout — finish here first.');
          return;
        default:
          setLastNote('Didn’t recognise a session command. Try “pause”, “set done”, “next exercise”, “finish workout”.');
      }
    },
    [pendingFinish, paused, canLogSet, onPause, onResume, onNextExercise, onSetDone, onFinishConfirmed],
  );

  const { state, start, stop, supported } = useSpeechRecognition({ onTranscript: handle });
  const listening = state.kind === 'listening';
  const label = stateLabel(state);

  if (!supported || state.kind === 'unsupported') {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500" role="status">
        <IconMicOff width={14} /> Voice control unavailable in this browser — typed controls work fully.
      </div>
    );
  }

  return (
    <div className="space-y-2" role="region" aria-label="Voice command centre">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={listening ? stop : start}
          aria-pressed={listening}
          aria-label={listening ? 'Stop listening' : 'Start voice command'}
          className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition ${
            listening
              ? 'border-electric-400 bg-electric-500/20 text-electric-200'
              : 'border-white/12 bg-white/[0.04] text-slate-300 hover:border-electric-500/40 hover:text-electric-300'
          }`}
        >
          <IconMic width={18} />
          {listening && <span className="absolute inset-0 animate-ping rounded-full border border-electric-400/40" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-slate-400">
            {pendingFinish
              ? 'End workout? Say “confirm” or tap the button. Any other command queues normally after cancelling.'
              : 'Voice: “pause” · “resume” · “set done” · “next exercise” · “finish workout”'}
          </p>
          {heard && <p className="truncate text-[11px] text-slate-500">Heard: {heard}</p>}
        </div>
        {pendingFinish && (
          <Button className="px-3 py-1.5 text-xs" glow onClick={() => { setPendingFinish(false); setLastNote('Finishing workout…'); onFinishConfirmed(); }}>
            <IconCheck width={14} /> Confirm
          </Button>
        )}
      </div>
      {(label ?? lastNote) && (
        <p className={`flex items-center gap-1.5 text-[11px] ${state.kind === 'error' || state.kind === 'denied' ? 'text-amber-300/90' : 'text-slate-500'}`} role="status">
          {(state.kind === 'error' || state.kind === 'denied') && <IconAlert width={12} />}
          {label ?? lastNote}
        </p>
      )}
    </div>
  );
}
