import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  User,
  Activity,
  LogOut,
  Sparkles,
  Check,
  RefreshCw,
  ExternalLink,
  Shield,
  Palette,
  Mic,
  Video,
  Volume2,
  Headphones,
  Sliders,
  CheckCircle2
} from 'lucide-react';
import { generateAvatar } from '../utils/avatar';

const AVATAR_PRESETS = [
  generateAvatar('Gamer1'),
  generateAvatar('CyberNinja'),
  generateAvatar('ProSniper'),
  generateAvatar('HeroX'),
  generateAvatar('Valkyrie'),
  generateAvatar('Felix')
];

const BANNER_COLORS = [
  '#5865F2', // Blurple
  '#57F287', // Green
  '#FEE75C', // Yellow
  '#EB459E', // Pink
  '#ED4245', // Red
  '#18191C'  // Dark
];

export function UserSettingsModal({
  currentUser,
  onClose,
  onUpdateProfile,
  onLogout,
  keepAliveStatus,
  onTriggerPing
}) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'voice' | 'keepalive'

  // Profile Form States
  const [displayName, setDisplayName] = useState(currentUser?.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar_url || '');
  const [bannerColor, setBannerColor] = useState(currentUser?.banner_color || '#5865F2');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [statusMode, setStatusMode] = useState(currentUser?.status_mode || 'online');
  const [statusText, setStatusText] = useState(currentUser?.status_text || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [pingTesting, setPingTesting] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  // Voice Test States
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);
  const [isTestingCam, setIsTestingCam] = useState(false);

  const testMicStreamRef = useRef(null);
  const testCamStreamRef = useRef(null);
  const testCamVideoRef = useRef(null);
  const testAudioCtxRef = useRef(null);
  const testAnimRef = useRef(null);

  // Clean up any test media when closing or changing tabs
  const stopAllMediaTests = () => {
    if (testAnimRef.current) cancelAnimationFrame(testAnimRef.current);
    if (testAudioCtxRef.current && testAudioCtxRef.current.state !== 'closed') {
      testAudioCtxRef.current.close().catch(() => {});
      testAudioCtxRef.current = null;
    }
    if (testMicStreamRef.current) {
      testMicStreamRef.current.getTracks().forEach((t) => t.stop());
      testMicStreamRef.current = null;
    }
    if (testCamStreamRef.current) {
      testCamStreamRef.current.getTracks().forEach((t) => t.stop());
      testCamStreamRef.current = null;
    }
    setIsTestingMic(false);
    setIsTestingCam(false);
    setMicVolumeLevel(0);
  };

  useEffect(() => {
    return () => {
      stopAllMediaTests();
    };
  }, []);

  const handleToggleMicTest = async () => {
    if (isTestingMic) {
      stopAllMediaTests();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        testMicStreamRef.current = stream;
        setIsTestingMic(true);

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        testAudioCtxRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;

        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!testMicStreamRef.current) return;
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length;
          // Scale to 0-100%
          const pct = Math.min(100, Math.round((avg / 80) * 100));
          setMicVolumeLevel(pct);
          testAnimRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch (err) {
        alert('Não foi possível acessar o microfone para teste: ' + err.message);
      }
    }
  };

  const handleToggleCamTest = async () => {
    if (isTestingCam) {
      if (testCamStreamRef.current) {
        testCamStreamRef.current.getTracks().forEach((t) => t.stop());
        testCamStreamRef.current = null;
      }
      setIsTestingCam(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } }
        });
        testCamStreamRef.current = stream;
        setIsTestingCam(true);
        setTimeout(() => {
          if (testCamVideoRef.current) {
            testCamVideoRef.current.srcObject = stream;
            testCamVideoRef.current.play().catch(() => {});
          }
        }, 100);
      } catch (err) {
        alert('Não foi possível acessar a câmera para teste: ' + err.message);
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onUpdateProfile({
        displayName,
        avatarUrl,
        bannerColor,
        bio,
        statusMode,
        statusText
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      alert('Erro ao salvar perfil: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestPing = async () => {
    setPingTesting(true);
    setPingResult(null);
    try {
      const res = await onTriggerPing();
      setPingResult(res);
    } catch (err) {
      setPingResult({ error: err.message });
    } finally {
      setPingTesting(false);
    }
  };

  const statusColors = {
    online: 'bg-discord-green',
    idle: 'bg-discord-yellow',
    dnd: 'bg-discord-red',
    offline: 'bg-discord-muted'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="relative w-full max-w-4xl h-[85vh] bg-discord-chat rounded-2xl shadow-2xl border border-white/5 flex overflow-hidden">
        {/* Settings Navigation Sidebar */}
        <div className="w-60 bg-discord-dark py-6 px-4 flex flex-col justify-between border-r border-discord-darkest/60">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-discord-muted px-2 mb-2">
              Configurações de Usuário
            </h2>

            <div className="space-y-1">
              <button
                onClick={() => {
                  stopAllMediaTests();
                  setActiveTab('profile');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'profile'
                    ? 'bg-discord-active text-white shadow'
                    : 'text-discord-muted hover:bg-discord-hover hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                Perfil do Usuário
              </button>

              <button
                onClick={() => {
                  stopAllMediaTests();
                  setActiveTab('voice');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'voice'
                    ? 'bg-discord-active text-white shadow'
                    : 'text-discord-muted hover:bg-discord-hover hover:text-white'
                }`}
              >
                <Mic className="w-4 h-4 text-discord-blurple" />
                Voz e Vídeo
              </button>

              <button
                onClick={() => {
                  stopAllMediaTests();
                  setActiveTab('keepalive');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                  activeTab === 'keepalive'
                    ? 'bg-discord-active text-white shadow'
                    : 'text-discord-muted hover:bg-discord-hover hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4 text-emerald-400" />
                Anti-Sleep (Render 24/7)
              </button>
            </div>
          </div>

          {/* Logout button */}
          <div className="pt-4 border-t border-white/10">
            <button
              onClick={() => {
                stopAllMediaTests();
                onLogout();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-discord-red hover:bg-discord-red/10 transition"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-y-auto p-8 relative">
          {/* Close button (ESC) */}
          <button
            onClick={() => {
              stopAllMediaTests();
              onClose();
            }}
            className="absolute top-6 right-6 p-2 rounded-full border border-white/10 text-discord-muted hover:text-white hover:bg-white/5 transition flex items-center gap-1 text-xs"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline font-bold">ESC</span>
          </button>

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="max-w-2xl">
              <h1 className="text-xl font-black text-white mb-6">
                Perfil de Usuário
              </h1>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Form Inputs */}
                <form onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Nome de Exibição
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={currentUser?.username}
                      className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Status Personalizado
                    </label>
                    <input
                      type="text"
                      value={statusText}
                      onChange={(e) => setStatusText(e.target.value)}
                      placeholder="Ex: Jogando com os amigos"
                      className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Modo de Status
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'online', label: 'Online', color: 'bg-discord-green' },
                        { id: 'idle', label: 'Ausente', color: 'bg-discord-yellow' },
                        { id: 'dnd', label: 'Não Perturbe', color: 'bg-discord-red' },
                        { id: 'offline', label: 'Invisível', color: 'bg-discord-muted' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setStatusMode(item.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition ${
                            statusMode === item.id
                              ? 'border-discord-blurple bg-discord-blurple/20 text-white'
                              : 'border-white/5 bg-discord-darkest text-discord-muted hover:text-white'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Avatar (URL direta ou escolha abaixo)
                    </label>
                    <input
                      type="text"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-xs focus:outline-none focus:ring-2 focus:ring-discord-blurple mb-2"
                    />
                    <div className="flex gap-2">
                      {AVATAR_PRESETS.map((preset, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setAvatarUrl(preset)}
                          className={`w-9 h-9 rounded-full overflow-hidden border-2 transition ${
                            avatarUrl === preset ? 'border-discord-blurple scale-110' : 'border-transparent hover:scale-105'
                          }`}
                        >
                          <img src={preset} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Cor do Banner de Perfil
                    </label>
                    <div className="flex items-center gap-2">
                      {BANNER_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setBannerColor(color)}
                          style={{ backgroundColor: color }}
                          className={`w-7 h-7 rounded-full border-2 transition ${
                            bannerColor === color ? 'border-white scale-110' : 'border-transparent'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-discord-muted mb-1.5">
                      Sobre Mim
                    </label>
                    <textarea
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Conte um pouco sobre você..."
                      className="w-full px-3 py-2 rounded-lg bg-discord-darkest border border-white/5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-discord-blurple"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-2.5 rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover font-semibold text-white text-sm transition shadow-lg flex items-center justify-center gap-2"
                  >
                    {saving ? 'Salvando...' : savedSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" /> Salvo com Sucesso!
                      </>
                    ) : (
                      'Salvar Alterações'
                    )}
                  </button>
                </form>

                {/* Live Discord Profile Card Preview */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-discord-muted mb-2">
                    Pré-Visualização do Perfil
                  </h3>
                  <div className="w-full bg-discord-darkest rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                    <div
                      style={{ backgroundColor: bannerColor }}
                      className="h-24 w-full relative transition-colors duration-300"
                    />

                    <div className="px-4 pb-4 relative">
                      <div className="relative -mt-12 mb-3 inline-block">
                        <img
                          src={avatarUrl || generateAvatar(currentUser?.username)}
                          alt=""
                          className="w-20 h-20 rounded-full border-4 border-discord-darkest bg-discord-dark object-cover shadow"
                        />
                        <span
                          className={`absolute bottom-0 right-0 w-5 h-5 rounded-full ring-4 ring-discord-darkest ${statusColors[statusMode]}`}
                        />
                      </div>

                      <div className="p-3 bg-discord-dark rounded-xl space-y-2">
                        <div>
                          <h4 className="text-base font-black text-white">
                            {displayName || currentUser?.username}
                          </h4>
                          <p className="text-xs text-discord-muted">
                            @{currentUser?.username}
                          </p>
                        </div>

                        {statusText && (
                          <div className="text-xs text-discord-text bg-discord-input/60 px-2.5 py-1.5 rounded-md font-medium">
                            {statusText}
                          </div>
                        )}

                        <div className="pt-2 border-t border-white/5">
                          <span className="text-[10px] uppercase font-bold text-discord-muted block mb-1">
                            Sobre Mim
                          </span>
                          <p className="text-xs text-discord-text whitespace-pre-wrap">
                            {bio || 'Nenhuma descrição adicionada.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VOICE & VIDEO SETTINGS TAB */}
          {activeTab === 'voice' && (
            <div className="max-w-2xl space-y-8">
              <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2">
                  <Mic className="w-6 h-6 text-discord-blurple" />
                  Configurações de Voz e Vídeo
                </h1>
                <p className="text-sm text-discord-muted mt-1">
                  Teste o seu microfone e câmera antes de entrar na call com seus amigos.
                </p>
              </div>

              {/* Microphone Test Section */}
              <div className="p-5 rounded-2xl bg-discord-darkest border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-discord-green" /> Teste de Microfone
                    </h3>
                    <p className="text-xs text-discord-muted">
                      Fale ao microfone para verificar se seu áudio está sendo captado perfeitamente.
                    </p>
                  </div>

                  <button
                    onClick={handleToggleMicTest}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition shadow ${
                      isTestingMic
                        ? 'bg-discord-red text-white hover:bg-red-600'
                        : 'bg-discord-blurple text-white hover:bg-discord-blurple-hover'
                    }`}
                  >
                    {isTestingMic ? 'Parar Teste' : 'Testar Microfone'}
                  </button>
                </div>

                {/* Animated Volume VU Meter Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-discord-muted font-mono">
                    <span>Nível de Entrada</span>
                    <span className="text-white font-bold">{micVolumeLevel}%</span>
                  </div>
                  <div className="h-3 bg-discord-dark rounded-full overflow-hidden p-0.5 border border-white/5">
                    <div
                      style={{ width: `${micVolumeLevel}%` }}
                      className={`h-full rounded-full transition-all duration-75 ${
                        micVolumeLevel > 70
                          ? 'bg-gradient-to-r from-emerald-500 to-amber-400'
                          : 'bg-discord-green shadow-sm shadow-discord-green/50'
                      }`}
                    />
                  </div>
                </div>

                {/* Hardware Enhancement Features */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/5 text-xs text-discord-muted">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-discord-dark/50">
                    <CheckCircle2 className="w-4 h-4 text-discord-green" />
                    <span>Cancelamento de Eco</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-discord-dark/50">
                    <CheckCircle2 className="w-4 h-4 text-discord-green" />
                    <span>Supressão de Ruído</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-discord-dark/50">
                    <CheckCircle2 className="w-4 h-4 text-discord-green" />
                    <span>Ganho Automático</span>
                  </div>
                </div>
              </div>

              {/* Camera Test Section */}
              <div className="p-5 rounded-2xl bg-discord-darkest border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Video className="w-4 h-4 text-discord-blurple" /> Teste de Câmera
                    </h3>
                    <p className="text-xs text-discord-muted">
                      Visualize a qualidade e o enquadramento do seu vídeo antes de abrir a câmera.
                    </p>
                  </div>

                  <button
                    onClick={handleToggleCamTest}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition shadow ${
                      isTestingCam
                        ? 'bg-discord-red text-white hover:bg-red-600'
                        : 'bg-discord-blurple text-white hover:bg-discord-blurple-hover'
                    }`}
                  >
                    {isTestingCam ? 'Desligar Câmera' : 'Testar Vídeo'}
                  </button>
                </div>

                {isTestingCam ? (
                  <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center relative">
                    <video
                      ref={testCamVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-black/70 px-2.5 py-1 rounded-md text-[10px] font-bold text-discord-green flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-discord-green animate-pulse" />
                      Câmera Ativa — 720p 30 FPS
                    </div>
                  </div>
                ) : (
                  <div className="w-full py-8 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-discord-muted text-xs gap-2">
                    <Video className="w-8 h-8 opacity-40" />
                    <span>Clique em "Testar Vídeo" para iniciar a pré-visualização.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* KEEP-ALIVE TAB */}
          {activeTab === 'keepalive' && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h1 className="text-xl font-black text-white flex items-center gap-2">
                  <Activity className="w-6 h-6 text-emerald-400" />
                  Sistema Anti-Sleep do Render (24/7 Grátis)
                </h1>
                <p className="text-sm text-discord-muted mt-1">
                  O plano grátis do Render desliga a aplicação após 15 minutos sem visitas. Nosso sistema envia self-pings automáticos para garantir que o seu DvD fique acordado para você e seus amigos jogarem a qualquer hora!
                </p>
              </div>

              {/* Status Box */}
              <div className="p-5 rounded-2xl bg-discord-darkest border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-4 h-4 rounded-full ${
                        keepAliveStatus?.active ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                      }`}
                    />
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Status do Anti-Sleep: {keepAliveStatus?.active ? 'ATIVO & PROTEGIDO' : 'AGUARDANDO URL DO RENDER'}
                      </h3>
                      <p className="text-xs text-discord-muted">
                        Intervalo de auto-requisição: A cada 10 minutos
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleTestPing}
                    disabled={pingTesting}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${pingTesting ? 'animate-spin' : ''}`} />
                    Testar Ping Agora
                  </button>
                </div>

                {pingResult && (
                  <div className="p-3 rounded-lg bg-black/40 text-xs text-discord-text border border-white/5 font-mono">
                    Resultado: {JSON.stringify(pingResult)}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5 text-xs">
                  <div className="p-2.5 rounded-lg bg-discord-dark">
                    <span className="text-discord-muted block">Total de Pings</span>
                    <span className="text-base font-bold text-white">
                      {keepAliveStatus?.totalPings || 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-discord-dark">
                    <span className="text-discord-muted block">Pings Bem-Sucedidos</span>
                    <span className="text-base font-bold text-emerald-400">
                      {keepAliveStatus?.successfulPings || 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-discord-dark">
                    <span className="text-discord-muted block">Tempo de Resposta</span>
                    <span className="text-base font-bold text-white">
                      {keepAliveStatus?.lastResponseTimeMs ? `${keepAliveStatus.lastResponseTimeMs}ms` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instructions Guide */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-discord-darkest border border-indigo-500/20 space-y-3 shadow-lg">
                <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-discord-yellow" />
                  Dica de Mestre para 100% de Uptime no Render:
                </h4>
                <p className="text-xs text-discord-text leading-relaxed">
                  Quando você fizer o deploy no <strong>Render.com</strong>, adicione a variável de ambiente:
                  <code className="mx-1 px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-mono">
                    APP_URL = https://sua-url.onrender.com
                  </code>
                  . O próprio servidor vai fazer ping em si mesmo a cada 10 minutos!
                </p>
                <p className="text-xs text-discord-text leading-relaxed">
                  Para redundância extra grátis, você também pode cadastrar a sua URL em serviços como <strong>cron-job.org</strong> ou <strong>UptimeRobot</strong> para chamar seu endpoint <code>/api/health</code> a cada 10 minutos sem nenhum custo!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
