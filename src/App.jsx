import React, { useState, useEffect, useRef } from 'react'; // Added useRef for stability
import { Upload, Mic, Download, FileText, Users, Sparkles, Play, Pause, Moon, Sun } from 'lucide-react';

export default function PodcastConverter() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [podcastUrl, setPodcastUrl] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [preferences, setPreferences] = useState({
    tone: 'conversational',
    length: 'medium',
    humor: true,
    depth: 'balanced'
  });

  // Use useRef to hold the interval IDs for cleanup
  const progressIntervalRef = useRef(null);
  const finalIntervalRef = useRef(null);

  useEffect(() => {
    if (podcastUrl && typeof podcastUrl === 'string') {
      const audio = new Audio(podcastUrl);
      audio.playbackRate = playbackSpeed;
      
      const updateTime = () => setCurrentTime(audio.currentTime);
      const setDurationData = () => setDuration(audio.duration);
      const handleEnded = () => setPlaying(false);

      audio.addEventListener('timeupdate', updateTime);
      audio.addEventListener('loadedmetadata', setDurationData);
      audio.addEventListener('ended', handleEnded);
      setAudioElement(audio);
      
      return () => {
        audio.pause();
        audio.removeEventListener('timeupdate', updateTime);
        audio.removeEventListener('loadedmetadata', setDurationData);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [podcastUrl]);

  useEffect(() => {
    if (audioElement) {
      audioElement.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, audioElement]);

  // Cleanup intervals on component unmount
  useEffect(() => {
    return () => {
      clearInterval(progressIntervalRef.current);
      clearInterval(finalIntervalRef.current);
    };
  }, []);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setStatus('idle');
      setPodcastUrl(null);
      setTranscript([]);
    } else {
      alert('Please select a PDF file');
    }
  };

  const handleConvert = async () => {
    if (!file) {
      alert('Please select a PDF file first');
      return;
    }
    
    // Clear any previous intervals just in case
    clearInterval(progressIntervalRef.current);
    clearInterval(finalIntervalRef.current);

    setStatus('uploading');
    setProgress(0);
    
    // --- FIX 1: Refined Progress Simulation ---
    // Start simulation: fast upload (0-15), slow processing wait (15-85).
    const startProgress = 15; // Set the initial upload/backend start value
    const waitCap = 85;    // Max progress while waiting for the long backend process
    
    // 1. Initial fast progress simulation (Upload + Backend Initialization)
    let currentSimulatedProgress = 0;
    progressIntervalRef.current = setInterval(() => {
        setProgress(prev => {
            currentSimulatedProgress = prev;
            
            if (currentSimulatedProgress < startProgress) {
                // Initial upload/parsing phase
                return prev + 1;
            } else if (currentSimulatedProgress < waitCap) {
                // Slow crawl during heavy Ollama/TTS processing
                return prev + 0.1; 
            } else {
                // Cap progress and wait for API response
                clearInterval(progressIntervalRef.current);
                return waitCap;
            }
        });
    }, 200);
    // ------------------------------------------

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('preferences', JSON.stringify(preferences));
    
    try {
      // API Call
      const response = await fetch(`${API_BASE_URL}/convert`, {
    method: 'POST',
    body: formData
    });
      
      // Stop the simulation interval once response is received
      clearInterval(progressIntervalRef.current);

      if (!response.ok) {
        throw new Error('Conversion failed');
      }
      
      setStatus('processing');
      
      const data = await response.json();
      
      // 2. Final progress push (Completion)
      finalIntervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(finalIntervalRef.current);
            setStatus('complete');
            setPodcastUrl(`${API_BASE_URL}/download/${data.filename}`);
            setTranscript(data.transcript || []);
            return 100;
          }
          // Fast jump to 100% after backend finishes
          return prev + 5; 
        });
      }, 50); // Faster interval for the final jump
      
    } catch (error) {
      console.error('Error:', error);
      clearInterval(progressIntervalRef.current);
      clearInterval(finalIntervalRef.current);
      setStatus('error');
      alert('Error converting PDF: ' + error.message);
    }
  };

  const togglePlayback = () => {
    if (audioElement) {
      if (playing) {
        audioElement.pause();
      } else {
        audioElement.play();
      }
      setPlaying(!playing);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    if (!audioElement || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    audioElement.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleDownload = () => {
    if (podcastUrl) {
      const a = document.createElement('a');
      a.href = podcastUrl;
      a.download = file?.name.replace('.pdf', '.mp3') || 'podcast.mp3';
      a.click();
    }
  };

  const bgClass = darkMode ? 'bg-zinc-950' : 'bg-stone-50';
  const cardClass = darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-stone-200';
  const textPrimary = darkMode ? 'text-zinc-100' : 'text-stone-900';
  const textSecondary = darkMode ? 'text-zinc-400' : 'text-stone-600';
  const accentClass = darkMode ? 'text-zinc-300' : 'text-stone-700';

  // --- FIX 2: Rounding the progress display ---
  const displayedProgress = Math.round(progress);

  return (
    <div className={`min-h-screen ${bgClass} transition-colors duration-500`} style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div className="max-w-4xl mx-auto px-6 py-16">
        
        <div className="absolute top-8 right-8">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-3 rounded-full ${cardClass} border transition-all duration-300 hover:scale-110`}
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
          </button>
        </div>

        <div className="text-center mb-12 animate-fadeIn">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="relative">
              <div className={`absolute inset-0 ${darkMode ? 'bg-zinc-100' : 'bg-stone-900'} opacity-20 blur-2xl animate-pulse-subtle`} />
              <Mic className={`w-10 h-10 ${darkMode ? 'text-zinc-100' : 'text-stone-900'} relative z-10 transition-transform hover:scale-110`} strokeWidth={1.5} />
            </div>
            <h1 className={`text-4xl font-light tracking-tight ${textPrimary}`} style={{ fontFamily: '"Cormorant Garamond", serif' }}>
              NoteCast
            </h1>
          </div>
          <p className={`text-base font-light ${textSecondary} mb-8`}>
            turn your pdfs into podcasts
          </p>
          
          {/* Feature Pills */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className={`${darkMode ? 'bg-zinc-900/50' : 'bg-stone-100'} ${darkMode ? 'border-zinc-800' : 'border-stone-200'} border backdrop-blur-sm px-4 py-2 rounded-full text-xs ${textSecondary} font-light flex items-center gap-2`}>
              <Sparkles className="w-3 h-3" strokeWidth={2} />
              ai-powered
            </div>
            <div className={`${darkMode ? 'bg-zinc-900/50' : 'bg-stone-100'} ${darkMode ? 'border-zinc-800' : 'border-stone-200'} border backdrop-blur-sm px-4 py-2 rounded-full text-xs ${textSecondary} font-light flex items-center gap-2`}>
              <Users className="w-3 h-3" strokeWidth={2} />
              dual speakers
            </div>
            <div className={`${darkMode ? 'bg-zinc-900/50' : 'bg-stone-100'} ${darkMode ? 'border-zinc-800' : 'border-stone-200'} border backdrop-blur-sm px-4 py-2 rounded-full text-xs ${textSecondary} font-light flex items-center gap-2`}>
              <FileText className="w-3 h-3" strokeWidth={2} />
              any length
            </div>
          </div>
        </div>

        <div className={`${cardClass} border rounded-3xl overflow-hidden shadow-sm transition-all duration-500`}>
          {/* Progress indicator for stages - Always visible */}
          <div className={`${darkMode ? 'bg-zinc-900/30' : 'bg-stone-100/50'} px-6 py-3 border-b ${darkMode ? 'border-zinc-800' : 'border-stone-200'}`}>
            <div className="flex items-center justify-between text-xs">
              <div className={`flex items-center gap-2 transition-opacity duration-300 ${
                status === 'idle' && !file ? 'opacity-100' : 'opacity-40'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-medium transition-colors ${
                  status === 'idle' && !file 
                    ? darkMode ? 'bg-zinc-800 text-zinc-100' : 'bg-stone-200 text-stone-900'
                    : file || status !== 'idle'
                    ? darkMode ? 'bg-zinc-100 text-zinc-900' : 'bg-stone-900 text-stone-50'
                    : darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-stone-200 text-stone-600'
                }`}>
                  {file || status !== 'idle' ? '✓' : '1'}
                </div>
                <span className={textSecondary}>upload</span>
              </div>
              <div className={`flex items-center gap-2 transition-opacity duration-300 ${
                file && status === 'idle' ? 'opacity-100' : 'opacity-40'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-medium transition-colors ${
                  file && status === 'idle'
                    ? darkMode ? 'bg-zinc-800 text-zinc-100' : 'bg-stone-200 text-stone-900'
                    : status === 'uploading' || status === 'processing' || status === 'complete'
                    ? darkMode ? 'bg-zinc-100 text-zinc-900' : 'bg-stone-900 text-stone-50'
                    : darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-stone-200 text-stone-600'
                }`}>
                  {status === 'uploading' || status === 'processing' || status === 'complete' ? '✓' : '2'}
                </div>
                <span className={textSecondary}>customize</span>
              </div>
              <div className={`flex items-center gap-2 transition-opacity duration-300 ${
                status === 'uploading' || status === 'processing' ? 'opacity-100' : status === 'complete' ? 'opacity-100' : 'opacity-40'
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-medium transition-colors ${
                  status === 'uploading' || status === 'processing'
                    ? darkMode ? 'bg-zinc-800 text-zinc-100' : 'bg-stone-200 text-stone-900'
                    : status === 'complete'
                    ? darkMode ? 'bg-zinc-100 text-zinc-900' : 'bg-stone-900 text-stone-50'
                    : darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-stone-200 text-stone-600'
                }`}>
                  {status === 'complete' ? '✓' : '3'}
                </div>
                <span className={textSecondary}>generate</span>
              </div>
            </div>
          </div>
          
          <div className="p-8">
          {status === 'idle' || status === 'uploading' || status === 'processing' ? (
            <div className="space-y-6">
              
              <div className={`relative border-2 border-dashed ${darkMode ? 'border-zinc-700 hover:border-zinc-600' : 'border-stone-300 hover:border-stone-400'} rounded-2xl p-12 text-center transition-all duration-300 group`}>
                {/* Subtle ambient glow */}
                <div className={`absolute inset-0 ${darkMode ? 'bg-zinc-400' : 'bg-stone-400'} opacity-0 group-hover:opacity-5 rounded-2xl blur-2xl transition-opacity duration-500`} />
                
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-upload"
                  disabled={status !== 'idle'}
                />
                <label htmlFor="pdf-upload" className={`${status !== 'idle' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} block relative z-10`}>
                  <Upload className={`w-12 h-12 ${textSecondary} mx-auto mb-4 transition-all duration-300 group-hover:scale-110 group-hover:-translate-y-1`} strokeWidth={1.5} />
                  <p className={`text-lg ${textPrimary} mb-1 font-light transition-colors duration-200`}>
                    {file ? file.name : 'drop your pdf'}
                  </p>
                  <p className={`text-sm ${textSecondary} font-light`}>or click to browse</p>
                  {file && (
                    <p className={`text-xs ${textSecondary} mt-2 font-mono`}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                </label>
              </div>

              {file && status === 'idle' && (
                <>
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`w-full ${darkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-stone-100 hover:bg-stone-200'} ${textPrimary} text-sm font-light py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group`}
                  >
                    <Sparkles className={`w-4 h-4 transition-transform duration-300 ${showSettings ? 'rotate-180' : ''}`} />
                    <span>{showSettings ? 'hide options' : 'customize'}</span>
                  </button>

                  {showSettings && (
                    <div className={`${darkMode ? 'bg-zinc-800' : 'bg-stone-100'} rounded-2xl p-6 space-y-5 animate-slideDown overflow-hidden`}>
                      
                      <div>
                        <label className={`block text-xs ${textSecondary} font-light mb-3 uppercase tracking-wider`}>tone</label>
                        <div className="flex gap-2">
                          {['casual', 'conversational', 'professional'].map((tone) => (
                            <button
                              key={tone}
                              onClick={() => setPreferences({...preferences, tone})}
                              className={`flex-1 py-2.5 px-4 rounded-xl text-sm transition-all duration-200 ${
                                preferences.tone === tone
                                  ? darkMode ? 'bg-zinc-100 text-zinc-900' : 'bg-stone-900 text-stone-50'
                                  : darkMode ? 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                              }`}
                            >
                              {tone}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className={`block text-xs ${textSecondary} font-light mb-3 uppercase tracking-wider`}>length</label>
                        <div className="flex gap-2">
                          {['short', 'medium', 'long'].map((length) => (
                            <button
                              key={length}
                              onClick={() => setPreferences({...preferences, length})}
                              className={`flex-1 py-2.5 px-4 rounded-xl text-sm transition-all duration-200 ${
                                preferences.length === length
                                  ? darkMode ? 'bg-zinc-100 text-zinc-900' : 'bg-stone-900 text-stone-50'
                                  : darkMode ? 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                              }`}
                            >
                              {length}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className={`block text-xs ${textSecondary} font-light mb-3 uppercase tracking-wider`}>depth</label>
                        <div className="flex gap-2">
                          {[
                            { key: 'overview', label: 'quick' },
                            { key: 'balanced', label: 'balanced' },
                            { key: 'deep-dive', label: 'deep' }
                          ].map((item) => (
                            <button
                              key={item.key}
                              onClick={() => setPreferences({...preferences, depth: item.key})}
                              className={`flex-1 py-2.5 px-4 rounded-xl text-sm transition-all duration-200 ${
                                preferences.depth === item.key
                                  ? darkMode ? 'bg-zinc-100 text-zinc-900' : 'bg-stone-900 text-stone-50'
                                  : darkMode ? 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                        <label className={`text-sm ${textPrimary} font-light`}>add some humor?</label>
                        <button
                          onClick={() => setPreferences({...preferences, humor: !preferences.humor})}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 ${
                            preferences.humor 
                              ? darkMode ? 'bg-zinc-100' : 'bg-stone-900'
                              : darkMode ? 'bg-zinc-700' : 'bg-stone-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full transition-all duration-300 shadow-sm ${
                              preferences.humor 
                                ? darkMode ? 'translate-x-6 bg-zinc-900' : 'translate-x-6 bg-stone-50'
                                : 'translate-x-1 bg-white'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleConvert}
                    className={`w-full ${darkMode ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200' : 'bg-stone-900 text-stone-50 hover:bg-stone-800'} text-base font-normal py-4 rounded-xl transition-all duration-300 hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    let's go
                  </button>
                </>
              )}

              {(status === 'uploading' || status === 'processing') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-zinc-400' : 'bg-stone-600'} animate-bounce`} style={{ animationDelay: '0ms' }} />
                    <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-zinc-400' : 'bg-stone-600'} animate-bounce`} style={{ animationDelay: '150ms' }} />
                    <div className={`w-2 h-2 rounded-full ${darkMode ? 'bg-zinc-400' : 'bg-stone-600'} animate-bounce`} style={{ animationDelay: '300ms' }} />
                  </div>
                  <p className={`text-center ${textSecondary} text-sm font-light`}>
                    {status === 'uploading' ? 'uploading...' : 'cooking your podcast...'}
                  </p>
                  <div className={`relative w-full ${darkMode ? 'bg-zinc-800' : 'bg-stone-200'} rounded-full h-1 overflow-hidden`}>
                    <div
                      className={`${darkMode ? 'bg-zinc-100' : 'bg-stone-900'} h-full transition-all duration-700 ease-out relative`}
                      style={{ width: `${displayedProgress}%` }}
                    >
                      <div className={`absolute inset-0 ${darkMode ? 'bg-zinc-300' : 'bg-stone-700'} opacity-50 animate-shimmer`} />
                    </div>
                  </div>
                  <p className={`text-center ${textSecondary} text-xs font-light font-mono`}>{displayedProgress}%</p>
                </div>
              )}
            </div>
          ) : status === 'complete' ? (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="text-center">
                <div className={`w-14 h-14 ${darkMode ? 'bg-zinc-800' : 'bg-stone-100'} rounded-full flex items-center justify-center mx-auto mb-3`}>
                  <Sparkles className={`w-7 h-7 ${accentClass}`} strokeWidth={1.5} />
                </div>
                <p className={`text-lg ${textPrimary} font-light`}>done!</p>
                <p className={`text-sm ${textSecondary} font-light`}>ready to listen</p>
              </div>

              <div className={`${darkMode ? 'bg-zinc-800' : 'bg-stone-100'} rounded-2xl p-6 transition-all duration-300`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={togglePlayback}
                      className={`w-12 h-12 ${darkMode ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200' : 'bg-stone-900 text-stone-50 hover:bg-stone-800'} rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110`}
                    >
                      {playing ? (
                        <Pause className="w-5 h-5" strokeWidth={2} />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5" strokeWidth={2} />
                      )}
                    </button>
                    <div>
                      <p className={`${textPrimary} font-normal text-sm`}>{file?.name.replace('.pdf', '')}</p>
                      <p className={`${textSecondary} text-xs font-light`}>your podcast</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleDownload}
                    className={`${darkMode ? 'hover:bg-zinc-700' : 'hover:bg-stone-200'} ${textSecondary} px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300`}
                  >
                    <Download className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
                
                <div 
                  className={`w-full ${darkMode ? 'bg-zinc-700' : 'bg-stone-200'} rounded-full h-1 cursor-pointer`}
                  onClick={handleSeek}
                >
                  <div 
                    className={`${darkMode ? 'bg-zinc-100' : 'bg-stone-900'} h-full rounded-full transition-all duration-300 relative`} 
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }} 
                  >
                    <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${darkMode ? 'bg-zinc-100' : 'bg-stone-900'} shadow-md`} />
                  </div>
                </div>
                
                {duration > 0 && (
                  <div className={`flex justify-between text-xs ${textSecondary} mt-2`}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                )}
                
                <div className={`flex items-center justify-between mt-4 pt-4 border-t ${darkMode ? 'border-zinc-700' : 'border-stone-300'}`}>
                  <span className={`text-xs ${textSecondary} font-light`}>speed</span>
                  <div className="flex gap-2">
                    {[0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`px-3 py-1 rounded-lg text-xs transition-all ${
                          playbackSpeed === speed
                            ? darkMode ? 'bg-zinc-100 text-zinc-900' : 'bg-stone-900 text-stone-50'
                            : darkMode ? 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600' : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`${darkMode ? 'bg-zinc-800/50' : 'bg-stone-50'} rounded-2xl p-6 border ${darkMode ? 'border-zinc-800' : 'border-stone-200'}`}>
                <h3 className={`text-xs font-normal ${textSecondary} mb-4 uppercase tracking-wider`}>
                  what they said
                </h3>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {transcript.length > 0 ? transcript.map((line, idx) => (
                    <div key={idx} className="flex gap-3 animate-fadeIn" style={{ animationDelay: `${idx * 100}ms` }}>
                      <span className={`font-medium text-xs ${line.speaker === 'HOST' ? (darkMode ? 'text-blue-400' : 'text-blue-600') : (darkMode ? 'text-emerald-400' : 'text-emerald-600')} uppercase tracking-wider flex-shrink-0`}>
                        {line.speaker === 'HOST' ? 'host' : 'expert'}
                      </span>
                      <span className={`${textSecondary} text-sm font-light leading-relaxed`}>{line.text}</span>
                    </div>
                  )) : (
                    <p className={`${textSecondary} text-sm font-light italic`}>transcript loading...</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  // Clean up state for new conversion
                  setFile(null);
                  setStatus('idle');
                  setPodcastUrl(null);
                  setTranscript([]);
                  setProgress(0);
                  setPlaying(false);
                  setCurrentTime(0);
                  setDuration(0);
                  if (audioElement) {
                    audioElement.pause();
                    setAudioElement(null);
                  }
                  clearInterval(progressIntervalRef.current);
                  clearInterval(finalIntervalRef.current);
                }}
                className={`w-full ${darkMode ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-stone-100 hover:bg-stone-200'} ${textPrimary} py-3 rounded-xl transition-all duration-300 text-sm font-light`}
              >
                do another one
              </button>
            </div>
          ) : status === 'error' ? (
            <div className="text-center space-y-4">
              <p className={`${textPrimary} font-light`}>something went wrong :/</p>
              <button
                onClick={() => {
                  setFile(null);
                  setStatus('idle');
                  setProgress(0);
                }}
                className={`${darkMode ? 'bg-zinc-100 text-zinc-900' : 'bg-stone-900 text-stone-50'} px-6 py-3 rounded-xl font-light`}
              >
                try again
              </button>
            </div>
          ) : null}
          </div>
        </div>

        <div className={`text-center mt-12 ${textSecondary} text-xs font-light`}>
          ai-powered podcast generation
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Cormorant+Garamond:wght@300;400;500&display=swap');
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideDown {
          from { 
            opacity: 0; 
            transform: translateY(-10px);
            max-height: 0;
          }
          to { 
            opacity: 1; 
            transform: translateY(0);
            max-height: 500px;
          }
        }
        
        @keyframes pulse-subtle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.3; }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out forwards;
        }
        
        .animate-slideUp {
          animation: slideUp 0.8s ease-out forwards;
        }
        
        .animate-slideDown {
          animation: slideDown 0.4s ease-out forwards;
        }
        
        .animate-pulse-subtle {
          animation: pulse-subtle 3s ease-in-out infinite;
        }
        
        .animate-shimmer {
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
