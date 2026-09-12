import { useEffect } from 'react';
import { useGameStore } from './game/store/gameStore';
import { GameCanvas } from './game/scene/GameCanvas';
import { Hud } from './hud/Hud';
import { TouchControls } from './game/input/TouchControls';
import { MenuShell } from './components/MenuShell';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorBoundary } from './sentry/ErrorBoundary';
import { Input, IS_TOUCH } from './game/input/InputManager';
import { SFX } from './game/audio/AudioEngine';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const volume = useGameStore((s) => s.settings.volume);

  // Global input wiring + audio volume sync.
  useEffect(() => {
    Input.init();
    const ro = useGameStore.subscribe((s) => {
      SFX.setVolume(s.settings.volume);
    });
    return () => { ro(); Input.dispose(); };
  }, []);

  useEffect(() => { SFX.setVolume(volume); }, [volume]);

  // Menu music vs. match ambience.
  useEffect(() => {
    if (phase === 'menu' || phase === 'loadout' || phase === 'settings') SFX.musicOn();
    else { SFX.musicOff(); if (phase === 'playing') SFX.ambienceOn(); else SFX.ambienceOff(); }
  }, [phase]);

  // Auto-pause when the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && useGameStore.getState().phase === 'playing') {
        useGameStore.getState().setPhase('paused');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const inMatch = phase === 'playing' || phase === 'paused' || phase === 'results';

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 bg-ink text-white overflow-hidden select-none">
        {inMatch && (
          <>
            <GameCanvas />
            {phase === 'playing' && (
              <>
                <Hud />
                {IS_TOUCH && <TouchControls />}
              </>
            )}
            {phase === 'paused' && <MenuShell screen="pause" />}
            {phase === 'results' && <MenuShell screen="results" />}
          </>
        )}
        {(phase === 'menu' || phase === 'loadout' || phase === 'settings') && (
          <MenuShell screen={phase} />
        )}
      </div>
    </ErrorBoundary>
  );
}

// Keep LoadingScreen import alive for Suspense fallbacks inside GameCanvas.
export { LoadingScreen };
