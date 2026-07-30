/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Shield, AlertTriangle, Bell, Settings, Camera, History, Power, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Siren sound URL
const SIREN_URL = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';

export default function App() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isAlerting, setIsAlerting] = useState(false);
  const [sensitivity, setSensitivity] = useState(30);
  const [isMuted, setIsMuted] = useState(false);
  const [logs, setLogs] = useState<{ id: string; time: string; msg: string }[]>([]);
  
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const requestRef = useRef<number>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ id: Math.random().toString(36).substr(2, 9), time, msg }, ...prev].slice(0, 10));
  };

  const playSiren = useCallback(() => {
    if (audioRef.current && !isMuted) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error("Audio play failed", e));
    }
  }, [isMuted]);

  const stopSiren = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const detectMotion = useCallback(() => {
    if (!isMonitoring || !webcamRef.current || !canvasRef.current) return;

    const video = webcamRef.current.video;
    if (!video || video.readyState !== 4) {
      requestRef.current = requestAnimationFrame(detectMotion);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Draw current video frame to hidden canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const currentFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (prevFrameRef.current) {
      let diff = 0;
      const data = currentFrame.data;
      const prevData = prevFrameRef.current.data;

      for (let i = 0; i < data.length; i += 4) {
        // Simple pixel difference (R+G+B)
        const rDiff = Math.abs(data[i] - prevData[i]);
        const gDiff = Math.abs(data[i + 1] - prevData[i + 1]);
        const bDiff = Math.abs(data[i + 2] - prevData[i + 2]);
        
        if (rDiff + gDiff + bDiff > 100) {
          diff++;
        }
      }

      // Threshold for motion
      const threshold = (canvas.width * canvas.height) * (sensitivity / 1000);
      if (diff > threshold) {
        if (!isAlerting) {
          setIsAlerting(true);
          addLog("⚠️ MOTION DETECTED: Potential Intrusion!");
          playSiren();
          // Reset alert after 5 seconds if no motion
          setTimeout(() => setIsAlerting(false), 5000);
        }
      }
    }

    prevFrameRef.current = currentFrame;
    requestRef.current = requestAnimationFrame(detectMotion);
  }, [isMonitoring, sensitivity, isAlerting, playSiren]);

  useEffect(() => {
    if (isMonitoring) {
      requestRef.current = requestAnimationFrame(detectMotion);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      setIsAlerting(false);
      stopSiren();
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isMonitoring, detectMotion, stopSiren]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] font-mono selection:bg-[#FF3B30] selection:text-white">
      {/* Hidden Audio for Siren */}
      <audio ref={audioRef} src={SIREN_URL} loop />

      {/* Header */}
      <header className="border-b border-[#222] p-4 flex justify-between items-center bg-[#111] sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isMonitoring ? 'bg-[#FF3B30] animate-pulse' : 'bg-[#333]'}`}>
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter uppercase italic">Sentinel CCTV</h1>
            <p className="text-[10px] text-[#666] uppercase tracking-widest">Advanced Security Protocol v4.2</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 hover:bg-[#222] rounded-full transition-colors"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-[#666]" /> : <Volume2 className="w-5 h-5 text-[#FF3B30]" />}
          </button>
          <div className="flex items-center gap-2 px-3 py-1 bg-[#222] rounded-full border border-[#333]">
            <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
            <span className="text-[10px] uppercase font-bold">{isMonitoring ? 'System Live' : 'System Offline'}</span>
          </div>
        </div>
      </header>

      <main className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {/* Main Camera View */}
        <div className="lg:col-span-3 space-y-6">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border-2 border-[#222] shadow-2xl group">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.92}
              className="w-full h-full object-cover grayscale contrast-125 opacity-80"
              videoConstraints={{ facingMode: "user" }}
              mirrored={false}
              imageSmoothing={true}
              forceScreenshotSourceSize={false}
              disablePictureInPicture={true}
              onUserMedia={() => addLog("Camera Access Granted")}
              onUserMediaError={(err) => addLog(`Camera Error: ${err}`)}
            />
            
            {/* Overlay UI */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Corner Accents */}
              <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-[#FF3B30]/50" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-[#FF3B30]/50" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-[#FF3B30]/50" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-[#FF3B30]/50" />
              
              {/* Scanning Line */}
              {isMonitoring && (
                <motion.div 
                  initial={{ top: 0 }}
                  animate={{ top: '100%' }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-[1px] bg-[#FF3B30]/30 shadow-[0_0_15px_rgba(255,59,48,0.5)] z-10"
                />
              )}

              {/* Alert Overlay */}
              <AnimatePresence>
                {isAlerting && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-[#FF3B30]/20 flex items-center justify-center z-20"
                  >
                    <div className="bg-black/80 border-2 border-[#FF3B30] p-8 rounded-2xl flex flex-col items-center gap-4 shadow-[0_0_50px_rgba(255,59,48,0.3)]">
                      <AlertTriangle className="w-16 h-16 text-[#FF3B30] animate-bounce" />
                      <h2 className="text-3xl font-black uppercase italic tracking-tighter">Theft Alert</h2>
                      <p className="text-sm text-[#FF3B30] animate-pulse uppercase font-bold">Intrusion Detected in Sector A</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Camera Info */}
              <div className="absolute top-6 left-6 flex flex-col gap-1">
                <span className="text-[10px] text-white/50 uppercase font-bold tracking-widest">Cam_01_Main_Entrance</span>
                <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">REC: {new Date().toLocaleDateString()}</span>
              </div>
              
              <div className="absolute bottom-6 right-6 flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-white/50 uppercase font-bold tracking-widest">Bitrate: 4.2 Mbps</span>
                  <span className="text-[10px] text-white/50 uppercase font-bold tracking-widest">FPS: 30.0</span>
                </div>
              </div>
            </div>

            {/* Hidden Canvas for Motion Processing */}
            <canvas ref={canvasRef} width="160" height="120" className="hidden" />
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                setIsMonitoring(!isMonitoring);
                addLog(isMonitoring ? "System Deactivated" : "System Armed & Monitoring");
              }}
              className={`flex items-center justify-center gap-3 p-6 rounded-2xl font-bold uppercase tracking-tighter transition-all ${
                isMonitoring 
                ? 'bg-[#FF3B30] text-white shadow-[0_0_30px_rgba(255,59,48,0.4)] hover:scale-[1.02]' 
                : 'bg-[#222] text-[#666] hover:bg-[#333]'
              }`}
            >
              <Power className="w-6 h-6" />
              {isMonitoring ? 'Disarm System' : 'Arm System'}
            </button>

            <div className="bg-[#111] p-6 rounded-2xl border border-[#222] flex flex-col justify-center">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] uppercase font-bold text-[#666]">Sensitivity</span>
                <span className="text-xs font-bold text-[#FF3B30]">{sensitivity}%</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="100" 
                value={sensitivity} 
                onChange={(e) => setSensitivity(parseInt(e.target.value))}
                className="w-full accent-[#FF3B30] h-1 bg-[#222] rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="bg-[#111] p-6 rounded-2xl border border-[#222] flex items-center justify-center gap-4">
              <div className="p-3 bg-[#222] rounded-xl">
                <Camera className="w-6 h-6 text-[#666]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[#666]">Active Device</span>
                <span className="text-xs font-bold truncate max-w-[120px]">Integrated_Webcam_HD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar / Logs */}
        <div className="space-y-6">
          {/* Status Widget */}
          <div className="bg-[#111] p-6 rounded-2xl border border-[#222] space-y-4">
            <div className="flex items-center gap-2 text-[#FF3B30]">
              <Bell className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-widest">System Status</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-[10px] uppercase font-bold">
                <span className="text-[#666]">Storage</span>
                <span>84% Free</span>
              </div>
              <div className="w-full bg-[#222] h-1 rounded-full overflow-hidden">
                <div className="bg-[#FF3B30] h-full w-[16%]" />
              </div>
              <div className="flex justify-between text-[10px] uppercase font-bold">
                <span className="text-[#666]">Uptime</span>
                <span>02:14:55</span>
              </div>
              <div className="flex justify-between text-[10px] uppercase font-bold">
                <span className="text-[#666]">Network</span>
                <span className="text-green-500">Stable</span>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden flex flex-col h-[400px]">
            <div className="p-4 border-b border-[#222] flex items-center gap-2 bg-[#151515]">
              <History className="w-4 h-4 text-[#666]" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Activity Log</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[#444] text-[10px] uppercase font-bold">
                  No recent activity
                </div>
              ) : (
                logs.map((log) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={log.id} 
                    className="flex flex-col gap-1 border-l-2 border-[#333] pl-3 py-1"
                  >
                    <span className="text-[9px] text-[#666] font-bold">{log.time}</span>
                    <span className={`text-[10px] font-bold ${log.msg.includes('⚠️') ? 'text-[#FF3B30]' : 'text-[#888]'}`}>
                      {log.msg}
                    </span>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Quick Settings */}
          <button className="w-full bg-[#111] p-4 rounded-2xl border border-[#222] flex items-center justify-between hover:bg-[#151515] transition-colors group">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-[#666] group-hover:rotate-90 transition-transform duration-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Config</span>
            </div>
            <div className="w-2 h-2 rounded-full bg-[#333]" />
          </button>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-[#222] px-6 py-2 flex justify-between items-center text-[9px] uppercase font-bold text-[#444] tracking-[0.2em]">
        <div className="flex gap-6">
          <span>Secure_Link_Established</span>
          <span>Enc_AES_256</span>
        </div>
        <div className="flex gap-6">
          <span>Lat: 37.7749° N</span>
          <span>Lon: 122.4194° W</span>
        </div>
      </footer>
    </div>
  );
}
