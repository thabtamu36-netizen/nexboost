import React, { useState, useEffect } from 'react';
import {
  Zap, Shield, Smartphone, Globe, Copy, Check, Clock, AlertTriangle, CheckCircle2, XCircle,
  CreditCard, ChevronRight, RefreshCw, Layers, User, Phone, Server, Send, ArrowRight, Eye,
  Lock, ArrowLeft, Download, Monitor, Sparkles, Filter, ExternalLink, HelpCircle, CheckCircle, Search, Home
} from 'lucide-react';

type TelegramUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('welcome');
  const [selectedNetwork, setSelectedNetwork] = useState('ethio');
  const [selectedDevice, setSelectedDevice] = useState('android');
  const [copiedDns, setCopiedDns] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('telebirr');
  const [txnRef, setTxnRef] = useState('');
  const [setupOs, setSetupOs] = useState('android');
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [isTelegramContext, setIsTelegramContext] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [engagementAccepted, setEngagementAccepted] = useState(false);

  const [timeLeft, setTimeLeft] = useState({ hours: 23, minutes: 54, seconds: 18 });

  const goHome = () => {
    setEngagementAccepted(false);
    setActiveTab('welcome');
  };

  const goBack = () => {
    setEngagementAccepted(false);
    switch (activeTab) {
      case 'status':
        setActiveTab('payment');
        break;
      case 'payment':
      case 'free_trial':
        setActiveTab('plans');
        break;
      case 'network':
        setActiveTab('plans');
        break;
      case 'device':
        setActiveTab('network');
        break;
      case 'plans':
      case 'premium_dash':
      case 'expired':
      default:
        setActiveTab('welcome');
    }
  };

  useEffect(() => {
    const storedStatus = localStorage.getItem('nexboost-payment-status');
    if (storedStatus === 'pending' || storedStatus === 'approved' || storedStatus === 'rejected') {
      setPaymentStatus(storedStatus);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nexboost-payment-status', paymentStatus);
  }, [paymentStatus]);

  useEffect(() => {
    const telegramWindow = window as Window & {
      Telegram?: {
        WebApp?: {
          ready: () => void;
          expand: () => void;
          initDataUnsafe?: {
            user?: TelegramUser;
          };
        };
      };
    };

    const webApp = telegramWindow.Telegram?.WebApp;
    if (!webApp) {
      return;
    }

    setIsTelegramContext(true);
    webApp.ready();
    webApp.expand();

    const user = webApp.initDataUnsafe?.user ?? null;
    if (user) {
      setTelegramUser(user);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDns(true);
    setTimeout(() => setCopiedDns(false), 2000);
  };

  const telegramDisplayName = telegramUser?.first_name
    ? telegramUser.first_name
    : telegramUser?.username
      ? `@${telegramUser.username}`
      : 'Telegram user';

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-black">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-[400px] h-[780px] bg-[#000000] rounded-[48px] p-3 shadow-2xl shadow-cyan-950/40 border-[4px] border-slate-800 ring-1 ring-slate-700/50 flex flex-col">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-50 flex items-center justify-center">
            <div className="w-12 h-1 bg-slate-800 rounded-full" />
            <div className="absolute right-6 w-2.5 h-2.5 bg-slate-900 rounded-full border border-slate-800" />
          </div>

          <div className="mt-5 px-4 py-2 bg-[#17212b] rounded-t-2xl flex items-center justify-between border-b border-slate-800/80 z-40">
            <button
              onClick={goBack}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-bold text-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-white tracking-wide">NEXBOOST Bot</span>
              <span className="text-[9px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> mini app
              </span>
            </div>
            <button
              onClick={goHome}
              className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-300"
            >
              <Home className="w-3.5 h-3.5" />
              Home
            </button>
          </div>

          <div className="flex-1 bg-[#0b0f19] text-slate-100 overflow-y-auto custom-scrollbar rounded-b-2xl relative flex flex-col">
            {renderScreen(activeTab, {
              selectedNetwork,
              setSelectedNetwork,
              selectedDevice,
              setSelectedDevice,
              copiedDns,
              copyToClipboard,
              paymentMethod,
              setPaymentMethod,
              txnRef,
              setTxnRef,
              setupOs,
              setSetupOs,
              timeLeft,
              setActiveTab,
              telegramUser,
              isTelegramContext,
              telegramDisplayName,
              paymentStatus,
              setPaymentStatus,
              goBack,
              goHome,
              engagementAccepted,
              setEngagementAccepted,
            })}
          </div>

          <div className="w-full h-4 bg-black flex justify-center items-center rounded-b-[40px]">
            <div className="w-28 h-1 bg-slate-600 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function renderScreen(tabId: string, props: any) {
  switch (tabId) {
    case 'welcome':
      return <ScreenWelcome setActiveTab={props.setActiveTab} telegramUser={props.telegramUser} isTelegramContext={props.isTelegramContext} telegramDisplayName={props.telegramDisplayName} />;
    case 'plans':
      return <ScreenPlans setActiveTab={props.setActiveTab} engagementAccepted={props.engagementAccepted} setEngagementAccepted={props.setEngagementAccepted} />;
    case 'network':
      return <ScreenNetwork selectedNetwork={props.selectedNetwork} setSelectedNetwork={props.setSelectedNetwork} setActiveTab={props.setActiveTab} engagementAccepted={props.engagementAccepted} setEngagementAccepted={props.setEngagementAccepted} />;
    case 'device':
      return <ScreenDevice selectedDevice={props.selectedDevice} setSelectedDevice={props.setSelectedDevice} setActiveTab={props.setActiveTab} engagementAccepted={props.engagementAccepted} setEngagementAccepted={props.setEngagementAccepted} />;
    case 'free_trial':
      return <ScreenFreeTrial {...props} />;
    case 'payment':
      return <ScreenPayment {...props} engagementAccepted={props.engagementAccepted} setEngagementAccepted={props.setEngagementAccepted} />;
    case 'status':
      return <ScreenPaymentStatus setActiveTab={props.setActiveTab} paymentStatus={props.paymentStatus} setPaymentStatus={props.setPaymentStatus} goBack={props.goBack} goHome={props.goHome} />;
    case 'premium_dash':
      return <ScreenPremiumDashboard {...props} />;
    case 'expired':
      return <ScreenExpired setActiveTab={props.setActiveTab} />;
    case 'admin':
      return <ScreenAdmin />;
    default:
      return <ScreenWelcome setActiveTab={props.setActiveTab} />;
  }
}

function ScreenWelcome({
  setActiveTab,
  telegramUser,
  isTelegramContext,
  telegramDisplayName,
}: {
  setActiveTab: (tab: string) => void;
  telegramUser?: { first_name?: string; username?: string } | null;
  isTelegramContext?: boolean;
  telegramDisplayName?: string;
}) {
  return (
    <div className="flex-1 p-5 flex flex-col justify-between bg-gradient-to-b from-[#0e1424] via-[#0b0f19] to-[#080b12]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/50 text-[10px] font-semibold text-slate-300">
          <Zap className="w-3 h-3 text-emerald-400" />
          <span>eFootball Ethiopia Dedicated</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500">v2.4 Pro</span>
      </div>
      <div className="my-auto py-6 text-center flex flex-col items-center">
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-500 via-cyan-500 to-blue-600 p-0.5 shadow-xl shadow-emerald-500/20">
            <div className="w-full h-full bg-[#0b0f19] rounded-[14px] flex items-center justify-center">
              <Zap className="w-10 h-10 text-emerald-400 fill-emerald-400/20" />
            </div>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-black font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
            DNS Pro
          </div>
        </div>

        <h1 className="text-2xl font-black text-white tracking-tight">NEXBOOST</h1>
        <p className="text-xs font-semibold text-cyan-400 tracking-widest uppercase mt-0.5">
          Play Better • Connect Faster • Win More
        </p>

        <p className="text-xs text-slate-400 mt-4 leading-relaxed max-w-[260px]">
          Dedicated personal DNS routing engineered specifically for Ethiopian mobile eFootball gamers.
        </p>

        <div className="mt-6 w-full bg-[#131b2e] border border-slate-800 p-3 rounded-xl flex items-center gap-3 text-left">
          <div className="w-9 h-9 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-[10px] text-slate-400 font-medium">
              {isTelegramContext ? 'Telegram User Authenticated' : 'Demo mode (not launched from Telegram)'}
            </div>
            <div className="text-xs font-bold text-slate-200 truncate">
              {telegramUser?.username ? `@${telegramUser.username}` : telegramDisplayName || 'Guest player'}
            </div>
          </div>
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <Shield className="w-4 h-4 text-emerald-400 mb-1" />
          <div className="text-[11px] font-bold text-slate-200">Unique Credentials</div>
          <div className="text-[9px] text-slate-400">Personal DNS address generated for your account</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <Server className="w-4 h-4 text-cyan-400 mb-1" />
          <div className="text-[11px] font-bold text-slate-200">Ethio & Safaricom</div>
          <div className="text-[9px] text-slate-400">Optimized for Ethiopian mobile telco routes</div>
        </div>
      </div>

      <button
        onClick={() => setActiveTab('plans')}
        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 active:scale-[0.99] transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
      >
        <span>Get Started & Select Plan</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function ValidationGate({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-3 text-[11px] text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-950 accent-emerald-500"
      />
      <span>
        I confirm I have read the setup flow and understand this DNS service is for my device only. I agree to proceed after confirming my details.
      </span>
    </label>
  );
}

function ScreenPlans({ setActiveTab, engagementAccepted, setEngagementAccepted }: { setActiveTab: (tab: string) => void; engagementAccepted: boolean; setEngagementAccepted: (value: boolean) => void }) {
  const [selectedPlan, setSelectedPlan] = useState('monthly');

  return (
    <div className="flex-1 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Select Your Plan</h2>
            <p className="text-[11px] text-slate-400">Choose a DNS subscription tier</p>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">Step 1 of 3</span>
        </div>

        <div className="space-y-3">
          <div
            onClick={() => setSelectedPlan('trial')}
            className={`p-4 rounded-2xl border transition cursor-pointer relative ${
              selectedPlan === 'trial'
                ? 'bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/50'
                : 'bg-[#0f1422]/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Single Use Only
                </span>
                <h3 className="text-sm font-bold text-white mt-1">24-Hour Free Trial</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Instant activation. Experience personal DNS routing.</p>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-white">0.00</span>
                <span className="text-[10px] text-slate-400 block">ETB / 24 hrs</span>
              </div>
            </div>
          </div>

          <div
            onClick={() => setSelectedPlan('weekly')}
            className={`p-4 rounded-2xl border transition cursor-pointer relative ${
              selectedPlan === 'weekly'
                ? 'bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/50'
                : 'bg-[#0f1422]/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-white">Weekly Access</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">7 Days full personal DNS routing</p>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-white">149.99</span>
                <span className="text-[10px] text-slate-400 block">ETB / Week</span>
              </div>
            </div>
          </div>

          <div
            onClick={() => setSelectedPlan('monthly')}
            className={`p-4 rounded-2xl border transition cursor-pointer relative overflow-hidden ${
              selectedPlan === 'monthly'
                ? 'bg-gradient-to-b from-[#111c2e] to-[#0d1424] border-cyan-400 ring-1 ring-cyan-400/50'
                : 'bg-[#0f1422]/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="absolute top-0 right-0 bg-gradient-to-l from-cyan-400 to-emerald-400 text-slate-950 font-black text-[9px] px-3 py-0.5 rounded-bl-lg uppercase tracking-wider">
              Best Value
            </div>

            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Monthly VIP Pro <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">30 Days uninterrupted performance</p>
              </div>
              <div className="text-right">
                <span className="text-base font-black text-cyan-400">349.99</span>
                <span className="text-[10px] text-slate-400 block">ETB / Month</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                <Check className="w-3 h-3 text-cyan-400" /> Unique Personal DNS Hostname
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                <Check className="w-3 h-3 text-cyan-400" /> Priority Admin Payment Approval
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ValidationGate checked={engagementAccepted} onChange={setEngagementAccepted} />
      </div>

      <button
        onClick={() => {
          if (!engagementAccepted) return;
          setEngagementAccepted(false);
          if (selectedPlan === 'trial') setActiveTab('free_trial');
          else setActiveTab('network');
        }}
        disabled={!engagementAccepted}
        className="mt-4 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 transition flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>{selectedPlan === 'trial' ? 'Activate Free Trial' : 'Continue to Network Setup'}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function ScreenNetwork({ selectedNetwork, setSelectedNetwork, setActiveTab, engagementAccepted, setEngagementAccepted }: { selectedNetwork: string; setSelectedNetwork: (v: string) => void; setActiveTab: (tab: string) => void; engagementAccepted: boolean; setEngagementAccepted: (value: boolean) => void }) {
  return (
    <div className="flex-1 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Select Telco Network</h2>
            <p className="text-[11px] text-slate-400">Personal DNS target routing configuration</p>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">Step 2 of 3</span>
        </div>

        <div className="space-y-3">
          <div
            onClick={() => setSelectedNetwork('ethio')}
            className={`p-4 rounded-2xl border transition cursor-pointer flex items-center gap-4 ${
              selectedNetwork === 'ethio'
                ? 'bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/50'
                : 'bg-[#0f1422]/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Globe className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Ethio Telecom</h3>
                {selectedNetwork === 'ethio' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Optimized for Ethio Telecom 4G/LTE mobile networks</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">Ethio Route Ready</span>
              </div>
            </div>
          </div>

          <div
            onClick={() => setSelectedNetwork('safaricom')}
            className={`p-4 rounded-2xl border transition cursor-pointer flex items-center gap-4 ${
              selectedNetwork === 'safaricom'
                ? 'bg-slate-900 border-cyan-400 ring-1 ring-cyan-400/50'
                : 'bg-[#0f1422]/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <Globe className="w-6 h-6 text-cyan-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Safaricom Ethiopia</h3>
                {selectedNetwork === 'safaricom' && <CheckCircle className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Configured for Safaricom 4G data routing</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded">Safaricom Route Ready</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
          <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>Each network selection assigns an isolated DNS node tailored to your provider's mobile data gateways.</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ValidationGate checked={engagementAccepted} onChange={setEngagementAccepted} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('plans')}
          className="w-1/3 py-3.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase hover:bg-slate-700 transition"
        >
          Back
        </button>
        <button
          onClick={() => {
            if (!engagementAccepted) return;
            setEngagementAccepted(false);
            setActiveTab('device');
          }}
          disabled={!engagementAccepted}
          className="w-2/3 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 transition flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>Select Device</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ScreenDevice({ selectedDevice, setSelectedDevice, setActiveTab, engagementAccepted, setEngagementAccepted }: { selectedDevice: string; setSelectedDevice: (v: string) => void; setActiveTab: (tab: string) => void; engagementAccepted: boolean; setEngagementAccepted: (value: boolean) => void }) {
  return (
    <div className="flex-1 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Select Smartphone OS</h2>
            <p className="text-[11px] text-slate-400">Formated setup instructions for your OS</p>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">Step 3 of 3</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => setSelectedDevice('android')}
            className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col items-center text-center ${
              selectedDevice === 'android'
                ? 'bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/50'
                : 'bg-[#0f1422]/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2">
              <Smartphone className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Android Device</h3>
            <span className="text-[10px] text-slate-400 mt-1">Private DNS Settings (DoH / DoT)</span>
          </div>

          <div
            onClick={() => setSelectedDevice('iphone')}
            className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col items-center text-center ${
              selectedDevice === 'iphone'
                ? 'bg-slate-900 border-cyan-400 ring-1 ring-cyan-400/50'
                : 'bg-[#0f1422]/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-2">
              <Smartphone className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-sm font-bold text-white">iPhone (iOS)</h3>
            <span className="text-[10px] text-slate-400 mt-1">iOS Mobile Profile Config</span>
          </div>
        </div>

        <div className="mt-5 p-3.5 rounded-xl bg-[#121929] border border-slate-800">
          <div className="text-xs font-bold text-slate-200 mb-1">Configuration Summary</div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 py-1 border-b border-slate-800">
            <span>Selected Network:</span>
            <span className="text-emerald-400 font-semibold">Ethio Telecom</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 py-1">
            <span>Device OS:</span>
            <span className="text-cyan-400 font-semibold uppercase">{selectedDevice}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ValidationGate checked={engagementAccepted} onChange={setEngagementAccepted} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('network')}
          className="w-1/3 py-3.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase hover:bg-slate-700 transition"
        >
          Back
        </button>
        <button
          onClick={() => {
            if (!engagementAccepted) return;
            setEngagementAccepted(false);
            setActiveTab('payment');
          }}
          disabled={!engagementAccepted}
          className="w-2/3 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 transition flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>Proceed to Payment</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ScreenFreeTrial({ copiedDns, copyToClipboard, setupOs, setSetupOs, timeLeft, setActiveTab }: any) {
  const trialDns = 'ethio-trial-892.nexboost.net';

  return (
    <div className="flex-1 p-5 flex flex-col justify-between">
      <div className="space-y-4">
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <div>
              <div className="text-xs font-bold text-emerald-400">Free Trial Active</div>
              <div className="text-[10px] text-slate-400">Single-use 24-hour evaluation</div>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-black/40 px-2.5 py-1 rounded-lg border border-slate-800 text-xs font-mono font-bold text-slate-200">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f1524] border border-slate-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Your Unique Personal DNS Link</span>
          <div className="flex items-center gap-2 bg-[#070a12] p-2.5 rounded-xl border border-slate-800">
            <span className="text-xs font-mono text-emerald-400 font-bold truncate flex-1">{trialDns}</span>
            <button
              onClick={() => copyToClipboard(trialDns)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold transition flex items-center gap-1 shrink-0"
            >
              {copiedDns ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDns ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300">Setup Guide</span>
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setSetupOs('android')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                  setupOs === 'android' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                Android
              </button>
              <button
                onClick={() => setSetupOs('iphone')}
                className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                  setupOs === 'iphone' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400'
                }`}
              >
                iPhone
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-[11px] space-y-2">
            {setupOs === 'android' ? (
              <>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-emerald-400 font-bold">1.</span>
                  <span>Open Android <strong>Settings</strong> &gt; <strong>Network &amp; Internet</strong>.</span>
                </div>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-emerald-400 font-bold">2.</span>
                  <span>Select <strong>Private DNS</strong> &gt; Choose <strong>Private DNS provider hostname</strong>.</span>
                </div>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-emerald-400 font-bold">3.</span>
                  <span>Paste <code className="text-emerald-400 bg-black/50 px-1 rounded">{trialDns}</code> and save.</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-cyan-400 font-bold">1.</span>
                  <span>Open <strong>Settings</strong> &gt; <strong>Wi-Fi</strong> or <strong>Cellular Data Options</strong>.</span>
                </div>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-cyan-400 font-bold">2.</span>
                  <span>Tap <strong>Configure DNS</strong> &gt; Select <strong>Manual</strong>.</span>
                </div>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-cyan-400 font-bold">3.</span>
                  <span>Add Server: <code className="text-cyan-400 bg-black/50 px-1 rounded">{trialDns}</code>.</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => setActiveTab('plans')}
        className="mt-4 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
      >
        <span>Upgrade to Paid Subscription</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ScreenPayment({ paymentMethod, setPaymentMethod, txnRef, setTxnRef, setActiveTab, engagementAccepted, setEngagementAccepted }: any) {
  const isValidated = txnRef.trim().length > 0;

  return (
    <div className="flex-1 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white">Payment Checkout</h2>
          <span className="text-[11px] font-bold text-cyan-400">349.99 ETB</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setPaymentMethod('telebirr')}
            className={`p-3 rounded-xl border text-left transition ${
              paymentMethod === 'telebirr'
                ? 'bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/40'
                : 'bg-[#0f1422]/60 border-slate-800'
            }`}
          >
            <div className="text-xs font-bold text-white">Telebirr</div>
            <div className="text-[9px] text-slate-400">Direct Phone Transfer</div>
          </button>
          <button
            onClick={() => setPaymentMethod('cbe')}
            className={`p-3 rounded-xl border text-left transition ${
              paymentMethod === 'cbe'
                ? 'bg-slate-900 border-cyan-400 ring-1 ring-cyan-400/40'
                : 'bg-[#0f1422]/60 border-slate-800'
            }`}
          >
            <div className="text-xs font-bold text-white">CBE Bank</div>
            <div className="text-[9px] text-slate-400">Commercial Bank of Ethiopia</div>
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-[#0e1424] border border-slate-800 space-y-3 mb-4">
          {paymentMethod === 'telebirr' ? (
            <>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Telebirr Phone Number:</span>
                <span className="font-mono font-bold text-emerald-400">0907554351</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Account Receiver Name:</span>
                <span className="font-bold text-slate-200">Roman</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">CBE Account:</span>
                <span className="font-mono font-bold text-cyan-400">1000516714259</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Account Name:</span>
                <span className="font-bold text-slate-200">Kirubel Alemayehu</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-800/80">
            <span className="text-slate-400">Total Amount:</span>
            <span className="font-bold text-white">349.99 ETB</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 block">Transaction Reference Number</label>
          <input
            type="text"
            placeholder="e.g. FT24098X71 or TXN98124"
            value={txnRef}
            onChange={(e) => setTxnRef(e.target.value)}
            className="w-full bg-[#070a12] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
          />
          <p className="text-[10px] text-slate-500">Paste the reference code from your SMS confirmation for manual verification.</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ValidationGate checked={engagementAccepted} onChange={setEngagementAccepted} />
      </div>

      <button
        onClick={() => {
          if (!txnRef.trim() || !isValidated || !engagementAccepted) return;
          setEngagementAccepted(false);
          setActiveTab('status');
        }}
        disabled={!txnRef.trim() || !isValidated || !engagementAccepted}
        className="mt-4 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 transition flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>Submit Payment For Approval</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function ScreenPaymentStatus({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const [statusState, setStatusState] = useState('pending');

  return (
    <div className="flex-1 p-5 flex flex-col justify-between">
      <div>
        <div className="flex bg-[#0f1422] p-1 rounded-xl border border-slate-800 mb-4">
          <button
            onClick={() => setStatusState('pending')}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition ${
              statusState === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-slate-400'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusState('approved')}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition ${
              statusState === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setStatusState('rejected')}
            className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition ${
              statusState === 'rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-slate-400'
            }`}
          >
            Rejected
          </button>
        </div>

        {statusState === 'pending' && (
          <div className="p-5 rounded-2xl bg-[#0f1524] border border-amber-500/30 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
              <Clock className="w-6 h-6 text-amber-400 animate-spin" />
            </div>
            <h3 className="text-sm font-bold text-white">Payment Verification Pending</h3>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[240px]">
              Admin is verifying transaction reference <code className="text-amber-400 font-mono">FT24098X71</code>.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400 w-full text-left space-y-1">
              <div className="flex justify-between">
                <span>Estimated Time:</span>
                <span className="text-slate-200 font-bold">5 - 15 minutes</span>
              </div>
              <div className="flex justify-between">
                <span>Method:</span>
                <span className="text-slate-200">Telebirr Merchant</span>
              </div>
            </div>
          </div>
        )}

        {statusState === 'approved' && (
          <div className="p-5 rounded-2xl bg-[#0f1524] border border-emerald-500/30 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Payment Approved!</h3>
            <p className="text-[11px] text-slate-400 mt-1">Your 30-Day VIP Personal DNS credential has been generated.</p>
            <button
              onClick={() => setActiveTab('premium_dash')}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition"
            >
              Open Premium Dashboard
            </button>
          </div>
        )}

        {statusState === 'rejected' && (
          <div className="p-5 rounded-2xl bg-[#0f1524] border border-red-500/30 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Transaction Unverified</h3>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[240px]">
              Reference number could not be matched with bank record. Please re-submit or contact support.
            </p>

            <button
              onClick={() => setActiveTab('payment')}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs hover:bg-slate-700 transition"
            >
              Retry Payment Submission
            </button>
          </div>
        )}
      </div>

      <div className="text-center">
        <a href="#support" className="text-[11px] text-cyan-400 hover:underline">Need Help? Contact NEXBOOST Telegram Support</a>
      </div>
    </div>
  );
}

function ScreenPremiumDashboard({ copiedDns, copyToClipboard, setupOs, setSetupOs, setActiveTab }: any) {
  const proDns = 'ethio-pro-892.nexboost.net';

  return (
    <div className="flex-1 p-5 flex flex-col justify-between">
      <div className="space-y-4">
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/80 via-slate-900 to-emerald-950/40 border border-cyan-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <div>
              <div className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                <span>VIP Monthly Active</span> <Sparkles className="w-3 h-3" />
              </div>
              <div className="text-[10px] text-slate-400">Expires: Dec 6, 2026 (29 Days left)</div>
            </div>
          </div>
          <span className="text-[9px] font-bold bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">PRO ROUTE</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f1524] border border-slate-800">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Personal Dedicated DNS Address</span>
          <div className="flex items-center gap-2 bg-[#070a12] p-2.5 rounded-xl border border-slate-800">
            <span className="text-xs font-mono text-cyan-400 font-bold truncate flex-1">{proDns}</span>
            <button
              onClick={() => copyToClipboard(proDns)}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 text-[11px] font-bold transition flex items-center gap-1 shrink-0"
            >
              {copiedDns ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedDns ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300">Device Configuration</span>
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setSetupOs('android')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  setupOs === 'android' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                Android
              </button>
              <button
                onClick={() => setSetupOs('iphone')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  setupOs === 'iphone' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400'
                }`}
              >
                iPhone
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-[11px] space-y-2">
            {setupOs === 'android' ? (
              <>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-cyan-400 font-bold">1.</span>
                  <span>Open Android <strong>Settings</strong> &gt; <strong>Network &amp; Internet</strong>.</span>
                </div>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-cyan-400 font-bold">2.</span>
                  <span>Select <strong>Private DNS</strong> &gt; Choose <strong>Private DNS provider hostname</strong>.</span>
                </div>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-cyan-400 font-bold">3.</span>
                  <span>Paste <code className="text-cyan-400 bg-black/50 px-1 rounded">{proDns}</code> and save.</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-cyan-400 font-bold">1.</span>
                  <span>Open <strong>Settings</strong> &gt; <strong>Wi-Fi</strong> or <strong>Cellular Data Options</strong>.</span>
                </div>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-cyan-400 font-bold">2.</span>
                  <span>Tap <strong>Configure DNS</strong> &gt; Select <strong>Manual</strong>.</span>
                </div>
                <div className="flex gap-2 text-slate-300">
                  <span className="font-mono text-cyan-400 font-bold">3.</span>
                  <span>Add Server: <code className="text-cyan-400 bg-black/50 px-1 rounded">{proDns}</code>.</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => setActiveTab('expired')}
        className="mt-4 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 text-[11px] font-semibold transition"
      >
        Simulate Subscription Expiry
      </button>
    </div>
  );
}

function ScreenExpired({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  return (
    <div className="flex-1 p-5 flex flex-col justify-between">
      <div>
        <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/60 to-slate-900 border border-red-500/40 text-center flex flex-col items-center mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="text-sm font-bold text-white">Subscription Expired</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Your personal DNS credentials have been temporarily suspended.</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#0f1524] border border-slate-800 opacity-60 mb-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">Inactive Personal DNS Address</span>
          <div className="text-xs font-mono text-slate-500 line-through">ethio-pro-892.nexboost.net</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0e1424] border border-slate-800 text-xs space-y-2">
          <div className="font-bold text-slate-200">Quick Renewal Options:</div>
          <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80 text-[11px]">
            <span className="text-slate-300">Monthly VIP Pro (Recommended)</span>
            <span className="font-bold text-cyan-400">349.99 ETB</span>
          </div>
          <div className="flex justify-between items-center py-1.5 text-[11px]">
            <span className="text-slate-300">Weekly Access</span>
            <span className="font-bold text-slate-300">149.99 ETB</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => setActiveTab('plans')}
        className="mt-4 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider hover:opacity-95 transition flex items-center justify-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Renew Subscription Now</span>
      </button>
    </div>
  );
}

function ScreenAdmin() {
  const [adminTab, setAdminTab] = useState('pending');
  const [users, setUsers] = useState([
    { id: '1', name: 'Abebe_eFM', plan: 'Monthly VIP', method: 'Telebirr', ref: 'FT24098X71', status: 'pending', date: 'Just now' },
    { id: '2', name: 'Dawit_PES', plan: 'Weekly', method: 'CBE Bank', ref: 'CBE981240', status: 'pending', date: '5m ago' },
    { id: '3', name: 'Kebede_eF', plan: 'Monthly VIP', method: 'Telebirr', ref: 'FT11029A88', status: 'approved', date: '2h ago' },
    { id: '4', name: 'Yared_Gamer', plan: 'Weekly', method: 'Telebirr', ref: 'FT99201Z00', status: 'rejected', date: '1d ago' },
  ]);

  const updateStatus = (id: string, newStatus: string) => {
    setUsers(users.map(u => (u.id === id ? { ...u, status: newStatus } : u)));
  };

  const filteredUsers = users.filter(u => adminTab === 'all' || u.status === adminTab);

  return (
    <div className="flex-1 p-4 md:p-5 flex flex-col justify-between w-full max-w-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" /> Administrative Panel
            </h2>
            <p className="text-[11px] text-slate-400">Manage user payments and personal DNS provisioning</p>
          </div>
          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-1 rounded-full font-mono">Admin Verified</span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] text-slate-400">All Users</div>
            <div className="text-sm font-bold text-white mt-0.5">{users.length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-amber-500/30">
            <div className="text-[10px] text-amber-400">Pending</div>
            <div className="text-sm font-bold text-amber-400 mt-0.5">{users.filter(u => u.status === 'pending').length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30">
            <div className="text-[10px] text-emerald-400">Approved</div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">{users.filter(u => u.status === 'approved').length}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-900 border border-red-500/30">
            <div className="text-[10px] text-red-400">Rejected</div>
            <div className="text-sm font-bold text-red-400 mt-0.5">{users.filter(u => u.status === 'rejected').length}</div>
          </div>
        </div>

        <div className="flex bg-[#0f1422] p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
          {['pending', 'approved', 'rejected', 'all'].map(tab => (
            <button
              key={tab}
              onClick={() => setAdminTab(tab)}
              className={`flex-1 py-1.5 rounded-lg capitalize transition ${
                adminTab === tab ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredUsers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">No records found for this view filter.</div>
          ) : (
            filteredUsers.map(user => (
              <div key={user.id} className="p-3 rounded-xl bg-[#0e1424] border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">@{user.name}</span>
                  <span className="text-[10px] text-slate-500">{user.date}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{user.plan} • {user.method}</span>
                  <code className="bg-black/50 px-1.5 py-0.5 rounded text-cyan-400 font-mono text-[10px]">{user.ref}</code>
                </div>

                {user.status === 'pending' && (
                  <div className="flex gap-2 mt-1 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => updateStatus(user.id, 'approved')}
                      className="flex-1 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded text-[10px] font-bold transition"
                    >
                      Approve & Provision DNS
                    </button>
                    <button
                      onClick={() => updateStatus(user.id, 'rejected')}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 rounded text-[10px] font-bold transition"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


