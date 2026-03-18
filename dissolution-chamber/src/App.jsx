import { useState, useRef, useCallback, useEffect } from 'react';
import { readAVD } from './data/AVDReader.js';
import { getCollective, addEntry } from './data/CollectiveStore.js';
import { selectTrack } from './data/MusicSelector.js';
import { requestPermissions } from './components/PermissionPrompt.jsx';
import { PHASE_PARAMS } from './utils/constants.js';
import { lerp } from './utils/math.js';
import { VOICE_SCHEDULE, AMBIENT_SOUNDS } from './voices/scripts.js';

import AudioEngine from './engine/AudioEngine.js';
import { COLLECTIVE_TRACK } from './engine/CollectiveEngine.js';
import CouplingEngine from './engine/CouplingEngine.js';
import PhaseManager from './phases/PhaseManager.js';
import MotionHandler from './motion/MotionHandler.js';
import GestureMapper from './motion/GestureMapper.js';
import VoiceScheduler from './voices/VoiceScheduler.js';

import EntryScreen from './components/EntryScreen.jsx';
import DarkScreen from './components/DarkScreen.jsx';
import ExitScreen from './components/ExitScreen.jsx';

/**
 * Collect all unique audio file paths that need to be preloaded.
 */
function getAllAudioPaths(musicTrackPath) {
  const paths = new Set();

  // Music track
  paths.add(musicTrackPath);

  // Voice files from schedule
  for (const phase of Object.values(VOICE_SCHEDULE)) {
    for (const entries of Object.values(phase)) {
      for (const entry of entries) {
        paths.add(entry.file);
      }
    }
  }

  // Ambient sounds
  for (const path of AMBIENT_SOUNDS) {
    paths.add(path);
  }

  // Collective end track
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

export default function App() {
  const [view, setView] = useState('entry'); // entry | loading | experience | exit
  const [loadProgress, setLoadProgress] = useState(0);
  const [phase, setPhase] = useState('intro');

  const avdRef = useRef(readAVD());
  const collectiveRef = useRef(getCollective());

  const audioEngineRef = useRef(null);
  const phaseManagerRef = useRef(null);
  const couplingRef = useRef(null);
  const motionHandlerRef = useRef(null);
  const gestureMapperRef = useRef(null);
  const voiceSchedulerRef = useRef(null);
  const rafRef = useRef(null);

  const startExperience = useCallback(async () => {
    setView('loading');

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

    // 3. Select music track based on user AVD
    const avd = avdRef.current;
    const trackPath = selectTrack(avd);

    // 4. Preload all audio
    const allPaths = getAllAudioPaths(trackPath);
    await audioEngine.preloadAll(allPaths, (progress) => {
      setLoadProgress(progress);
    });

    // 5. Initialize audio graph with collective AVD
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
      setPhase(newPhase);
      console.log(`Phase: ${prevPhase} → ${newPhase}`);

      // Schedule voices for new phase
      voiceScheduler.schedulePhase(newPhase);

      // Start ambient sounds when entering ascent
      if (newPhase === 'ascent') {
        audioEngine.startAmbient();
        audioEngine.setTextureGain(0.15);
      }

      // On exit, stop everything
      if (newPhase === 'exit') {
        audioEngine.stopAll();
        voiceScheduler.stopAll();
        // Add user to collective
        addEntry(avdRef.current);
        collectiveRef.current = getCollective();
        setView('exit');
      }
    });

    // 8. Start music playback
    audioEngine.startMusic(trackPath);

    // 9. Transition to experience
    setView('experience');

    // 10. Start the main rAF loop
    const tick = (timestamp) => {
      const running = phaseManager.update(timestamp);
      if (!running) return;

      const phaseKey = phaseManager.getPhaseKey();
      const progress = phaseManager.phaseProgress;

      // Update coupling
      coupling.update(phaseManager.totalElapsed);

      // Read motion data and map to audio params
      const motionData = motionHandler.getData();
      const mapped = gestureMapper.map(motionData);

      // Apply gesture to music (Path 1)
      audioEngine.setMusicParams(mapped);

      // Update binaural beat frequency
      const beatFreq = getPhaseParam(phaseKey, 'binauralBeat', progress);
      audioEngine.binaural.setBeatFrequency(beatFreq);

      // Update binaural gain
      const binauralGain = getPhaseParam(phaseKey, 'binauralGain', progress);
      audioEngine.binaural.setGain(binauralGain);

      // Update modulation depth
      const modDepth = getPhaseParam(phaseKey, 'modDepth', progress);
      audioEngine.modulation.setDepth(modDepth);

      // Update music gain (individual fades out)
      const musicGain = getPhaseParam(phaseKey, 'musicGain', progress);
      audioEngine.setMusicGain(musicGain);

      // Update collective gain (collective fades in)
      const collectiveGain = getPhaseParam(phaseKey, 'collectiveGain', progress);
      audioEngine.collective.setGain(collectiveGain);

      // Update spatial orbits
      audioEngine.spatial.updateOrbits(
        phaseManager.deltaTime,
        phaseManager.currentPhase
      );

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioEngineRef.current?.stopAll();
    };
  }, []);

  const handleRestart = useCallback(() => {
    // Reset state for a fresh run
    avdRef.current = readAVD();
    collectiveRef.current = getCollective();
    setView('entry');
    setLoadProgress(0);
    setPhase('intro');
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

  const avd = avdRef.current;

  if (view === 'entry' || view === 'loading') {
    return (
      <EntryScreen
        avd={avd}
        onStart={startExperience}
        loading={view === 'loading'}
        loadProgress={loadProgress}
      />
    );
  }

  if (view === 'exit') {
    return (
      <ExitScreen
        userAVD={avd}
        collectiveAVD={collectiveRef.current.mean}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <DarkScreen
      phase={phase}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    />
  );
}
