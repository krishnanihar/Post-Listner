import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getCollective, addEntry } from '../chamber/data/CollectiveStore.js';
import { selectTrack } from '../chamber/data/MusicSelector.js';
import { requestPermissions } from '../chamber/components/PermissionPrompt.jsx';
import { PHASE_PARAMS } from '../chamber/utils/constants.js';
import { lerp } from '../chamber/utils/math.js';
import { VOICE_SCHEDULE, AMBIENT_SOUNDS, COLLECTIVE_TRACK } from '../chamber/voices/scripts.js';

import AudioEngine from '../chamber/engine/AudioEngine.js';
import CouplingEngine from '../chamber/engine/CouplingEngine.js';
import PhaseManager from '../chamber/phases/PhaseManager.js';
import MotionHandler from '../chamber/motion/MotionHandler.js';
import GestureMapper from '../chamber/motion/GestureMapper.js';
import VoiceScheduler from '../chamber/voices/VoiceScheduler.js';

import DarkScreen from '../chamber/components/DarkScreen.jsx';
import ExitScreen from '../chamber/components/ExitScreen.jsx';

/**
 * Collect all unique audio file paths that need to be preloaded.
 */
function getAllAudioPaths(musicTrackPath) {
  const paths = new Set();
  paths.add(musicTrackPath);
  for (const phase of Object.values(VOICE_SCHEDULE)) {
    for (const entries of Object.values(phase)) {
      for (const entry of entries) {
        paths.add(entry.file);
      }
    }
  }
  for (const path of AMBIENT_SOUNDS) {
    paths.add(path);
  }
  paths.add(COLLECTIVE_TRACK);
  return Array.from(paths);
}

/**
 * Interpolate a parameter for the current phase.
 */
function getPhaseParam(phaseKey, paramName, progress) {
  const params = PHASE_PARAMS[phaseKey];
  if (!params || !params[paramName]) return 0;
  const [start, end] = params[paramName];
  return lerp(start, end, progress);
}

/**
 * The Dissolution Chamber — embedded as a phase within PostListener.
 * Receives the AVDEngine instance and reads the user's AVD directly.
 */
export default function Chamber({ avd }) {
  const [view, setView] = useState('loading'); // loading | experience | exit
  const [loadProgress, setLoadProgress] = useState(0);
  const [chamberPhase, setChamberPhase] = useState('intro');

  // Map PostListener AVD format {a, v, d} to chamber format {arousal, valence, depth}
  const currentAVD = avd.getAVD();
  const userAVD = useRef({
    arousal: currentAVD.a,
    valence: currentAVD.v,
    depth: currentAVD.d,
  });
  const collectiveRef = useRef(getCollective());

  const audioEngineRef = useRef(null);
  const phaseManagerRef = useRef(null);
  const couplingRef = useRef(null);
  const motionHandlerRef = useRef(null);
  const gestureMapperRef = useRef(null);
  const voiceSchedulerRef = useRef(null);
  const rafRef = useRef(null);
  const startedRef = useRef(false);

  const startExperience = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    // 1. Request permissions and create AudioContext
    const { audioContext, hasMotionPermission } = await requestPermissions();

    // 2. Initialize engines
    const audioEngine = new AudioEngine(audioContext);
    audioEngineRef.current = audioEngine;

    const coupling = new CouplingEngine();
    couplingRef.current = coupling;

    const motionHandler = new MotionHandler();
    motionHandler.hasPermission = hasMotionPermission;
    motionHandler.start();
    motionHandlerRef.current = motionHandler;

    const gestureMapper = new GestureMapper(coupling);
    gestureMapperRef.current = gestureMapper;

    // 3. Select music track
    const trackPath = selectTrack(userAVD.current);

    // 4. Preload all audio
    const allPaths = getAllAudioPaths(trackPath);
    await audioEngine.preloadAll(allPaths, (progress) => {
      setLoadProgress(progress);
    });

    // 5. Initialize audio graph
    const collective = collectiveRef.current;
    audioEngine.init(collective.mean);

    // 6. Create voice scheduler
    const voiceScheduler = new VoiceScheduler(
      audioContext,
      audioEngine.buffers,
      audioEngine.spatial,
      audioEngine.voiceGain
    );
    voiceSchedulerRef.current = voiceScheduler;

    // 7. Set up phase manager
    const phaseManager = new PhaseManager();
    phaseManagerRef.current = phaseManager;

    phaseManager.onPhaseChange((newPhase, prevPhase) => {
      setChamberPhase(newPhase);
      console.log(`Chamber phase: ${prevPhase} → ${newPhase}`);

      voiceScheduler.schedulePhase(newPhase);

      if (newPhase === 'ascent') {
        audioEngine.startAmbient();
        audioEngine.startCollectiveTrack();
        audioEngine.setTextureGain(0.15);
      }

      if (newPhase === 'exit') {
        audioEngine.stopAll();
        voiceScheduler.stopAll();
        addEntry(userAVD.current);
        collectiveRef.current = getCollective();
        setView('exit');
      }
    });

    // 8. Start music
    audioEngine.startMusic(trackPath);

    // 9. Go live
    setView('experience');

    // 10. Main rAF loop
    const tick = (timestamp) => {
      const running = phaseManager.update(timestamp);
      if (!running) return;

      const phaseKey = phaseManager.getPhaseKey();
      const progress = phaseManager.phaseProgress;

      coupling.update(phaseManager.totalElapsed);

      const motionData = motionHandler.getData();
      const mapped = gestureMapper.map(motionData, motionHandler.hasMotion);

      // Debug: log motion→audio mapping every 60 frames (~1/sec)
      if (!tick._fc) tick._fc = 0;
      if (++tick._fc % 60 === 0) {
        console.log('[Chamber Motion]', {
          hasMotion: motionHandler.hasMotion,
          rms: motionData.rms.toFixed(2),
          beta: motionData.beta.toFixed(1),
          gamma: motionData.gamma.toFixed(1),
          pan: mapped.pan.toFixed(2),
          filter: mapped.filterNorm.toFixed(2),
          intensity: mapped.intensity.toFixed(2),
          coupling: coupling.getValue().toFixed(2),
        });
      }

      audioEngine.setMusicParams(mapped);
      audioEngine.binaural.setBeatFrequency(getPhaseParam(phaseKey, 'binauralBeat', progress));
      audioEngine.binaural.setGain(getPhaseParam(phaseKey, 'binauralGain', progress));
      audioEngine.modulation.setDepth(getPhaseParam(phaseKey, 'modDepth', progress));
      audioEngine.setMusicGain(getPhaseParam(phaseKey, 'musicGain', progress));
      audioEngine.collective.setGain(getPhaseParam(phaseKey, 'collectiveGain', progress));
      audioEngine.spatial.updateOrbits(phaseManager.deltaTime, phaseManager.currentPhase);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [avd]);

  // Auto-start on mount
  useEffect(() => {
    startExperience();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioEngineRef.current?.stopAll();
    };
  }, []);

  // Touch handlers for DarkScreen → GestureMapper fallback
  const handleTouchMove = useCallback((nx, ny) => {
    gestureMapperRef.current?.updateTouch(nx, ny, true);
  }, []);
  const handleTouchStart = useCallback(() => {
    gestureMapperRef.current?.updateTouch(0.5, 0.5, true);
  }, []);
  const handleTouchEnd = useCallback(() => {
    gestureMapperRef.current?.updateTouch(0.5, 0.5, false);
  }, []);

  if (view === 'loading') {
    return (
      <div
        className="h-full w-full flex flex-col items-center justify-center px-8"
        style={{ background: 'var(--bg)' }}
      >
        <p
          className="font-mono mb-6"
          style={{ fontSize: '11px', color: 'var(--text-dim)', letterSpacing: '0.15em' }}
        >
          PREPARING THE CHAMBER
        </p>
        <div
          className="w-48 h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--bg-subtle)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--accent)' }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(loadProgress * 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p
          className="font-mono mt-3"
          style={{ fontSize: '10px', color: 'var(--text-dim)' }}
        >
          {Math.round(loadProgress * 100)}%
        </p>
      </div>
    );
  }

  if (view === 'exit') {
    return (
      <ExitScreen
        userAVD={userAVD.current}
        collectiveAVD={collectiveRef.current.mean}
        onRestart={() => window.location.reload()}
      />
    );
  }

  return (
    <DarkScreen
      phase={chamberPhase}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    />
  );
}
