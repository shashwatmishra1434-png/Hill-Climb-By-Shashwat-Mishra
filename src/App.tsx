import React, { useState, useEffect } from 'react';
import { 
  Car, 
  Settings2, 
  Sparkles, 
  BookOpen, 
  Check, 
  Lock, 
  Coins, 
  RotateCcw,
  Zap,
  Gauge,
  CircleDot,
  Wrench,
  Compass,
  FileText,
  ShoppingBag,
  Tv,
  CreditCard,
  Volume2,
  ListFilter,
  ArrowRight,
  ShieldCheck,
  Award,
  GraduationCap,
  Heart,
  CloudLightning,
  RefreshCw,
  FolderSync,
  Key,
  MoreVertical,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { VEHICLES, STAGES, ARTICLES, getUpgradeCost, Vehicle, Stage, UpgradeState } from './data';
import { Simulator } from './components/Simulator';

// Google Authentication & Syncer
import { auth, loginWithGoogle, logoutFromGoogle } from './lib/firebaseAuth';
import { onAuthStateChanged, User } from 'firebase/auth';
import { findSaveFile, downloadSaveFile, uploadSaveFile } from './lib/driveSync';

const devImage = "/src/assets/images/shashwat_mishra_1781932143634.jpg";

export default function App() {
  // Game Progression State
  const [bankCoins, setBankCoins] = useState<number>(() => {
    const saved = localStorage.getItem('hcr_bank_coins');
    return saved ? parseInt(saved, 10) : 55000; // start with generous 55,000 coins
  });

  const [unlockedVehicles, setUnlockedVehicles] = useState<string[]>(() => {
    const saved = localStorage.getItem('hcr_unlocked_vehicles');
    return saved ? JSON.parse(saved) : ['jeep'];
  });

  const [upgrades, setUpgrades] = useState<Record<string, UpgradeState>>(() => {
    const saved = localStorage.getItem('hcr_vehicle_upgrades');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Continue to default
      }
    }
    const initial: Record<string, UpgradeState> = {};
    VEHICLES.forEach(v => {
      initial[v.id] = { engine: 1, suspension: 1, tires: 1, fourWd: 1 };
    });
    return initial;
  });

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => {
    return localStorage.getItem('hcr_selected_vehicle') || 'jeep';
  });

  const [selectedStageId, setSelectedStageId] = useState<string>(() => {
    return localStorage.getItem('hcr_selected_stage') || 'countryside';
  });

  // Elegant Game Toast Message Overlay State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' | 'warning' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Discrete Page Navigation State
  // 'play' | 'garage' | 'stages' | 'shop' | 'wiki' | 'settings' | 'developer'
  const [activePage, setActivePage] = useState<'play' | 'garage' | 'stages' | 'shop' | 'wiki' | 'settings' | 'developer'>('play');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<'navigation' | 'dashboard'>('navigation');
  const [language, setLanguage] = useState<'hinglish' | 'english'>('hinglish');
  const [isPC, setIsPC] = useState<boolean>(true);

  useEffect(() => {
    const checkIsPC = () => {
      const touchSupport = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const isLargeScreen = window.innerWidth >= 1024;
      setIsPC(!touchSupport || isLargeScreen);
    };
    checkIsPC();
    window.addEventListener('resize', checkIsPC);
    return () => window.removeEventListener('resize', checkIsPC);
  }, []);

  // Cloud Sync & Auth States
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isDeveloper, setIsDeveloper] = useState<boolean>(false);
  const [devLogs, setDevLogs] = useState<any[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState<boolean>(false);
  const [showBypassModal, setShowBypassModal] = useState<boolean>(false);
  const [manualEmail, setManualEmail] = useState<string>('');

  // Listen for login status on mount (checks offline/bypass session first)
  useEffect(() => {
    const manualSavedEmail = localStorage.getItem('hcr_manual_email');
    if (manualSavedEmail) {
      const emailLower = manualSavedEmail.toLowerCase();
      const devMode = emailLower === "shashwatmishra7181@gmail.com";
      const parsedDisplayName = emailLower.split('@')[0];
      
      setUser({
        email: emailLower,
        displayName: parsedDisplayName.charAt(0).toUpperCase() + parsedDisplayName.slice(1),
        photoURL: devMode ? devImage : null,
      } as any);
      setIsDeveloper(devMode);
      if (devMode) {
        setBankCoins(99999999);
        setUnlockedVehicles(VEHICLES.map(v => v.id));
      }
    } else {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          const emailLower = currentUser.email?.toLowerCase() || "";
          const devMode = emailLower === "shashwatmishra7181@gmail.com";
          setIsDeveloper(devMode);
          if (devMode) {
            setBankCoins(99999999);
            setUnlockedVehicles(VEHICLES.map(v => v.id));
          }
        } else {
          setUser(null);
          setToken(null);
          setIsDeveloper(false);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Fetch user log reports if currentUser is Shashwat Mishra (isDeveloper)
  useEffect(() => {
    const fetchReports = async () => {
      if (activePage === 'developer' && isDeveloper && user?.email) {
        try {
          setIsFetchingLogs(true);
          const response = await fetch(`/api/login-records?email=${encodeURIComponent(user.email)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setDevLogs(data.logs || []);
            }
          }
        } catch (err) {
          console.error("Failed to load developer dashboard telemetry logs:", err);
        } finally {
          setIsFetchingLogs(false);
        }
      }
    };
    fetchReports();
  }, [activePage, isDeveloper, user]);

  // Ad watcher states
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(0);
  const [adMessage, setAdMessage] = useState('');

  // Sandbox payment status
  const [paymentAmount, setPaymentAmount] = useState<number | null>(null);
  const [purchaseStatus, setPurchaseStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [fakeCard, setFakeCard] = useState('');

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('hcr_bank_coins', bankCoins.toString());
  }, [bankCoins]);

  useEffect(() => {
    localStorage.setItem('hcr_unlocked_vehicles', JSON.stringify(unlockedVehicles));
  }, [unlockedVehicles]);

  useEffect(() => {
    localStorage.setItem('hcr_vehicle_upgrades', JSON.stringify(upgrades));
  }, [upgrades]);

  useEffect(() => {
    localStorage.setItem('hcr_selected_vehicle', selectedVehicleId);
  }, [selectedVehicleId]);

  useEffect(() => {
    localStorage.setItem('hcr_selected_stage', selectedStageId);
  }, [selectedStageId]);

  // Handle active assets
  const activeVehicle = VEHICLES.find(v => v.id === selectedVehicleId) || VEHICLES[0];
  const activeStage = STAGES.find(s => s.id === selectedStageId) || STAGES[0];
  const activeVehicleUpgrades = upgrades[activeVehicle.id] || { engine: 1, suspension: 1, tires: 1, fourWd: 1 };

  // Synchronize state with Google Drive & Backend User Log
  const syncToCloud = async (coinsToSave = bankCoins, vehiclesToSave = unlockedVehicles, upgradesToSave = upgrades) => {
    if (user && token && !isDeveloper) {
      try {
        setIsSyncing(true);
        await uploadSaveFile(token, {
          bankCoins: coinsToSave,
          unlockedVehicles: vehiclesToSave,
          upgrades: upgradesToSave,
          selectedVehicleId,
          selectedStageId,
        });
      } catch (err) {
        console.error("Cloud auto-sync background failed:", err);
      } finally {
        setIsSyncing(false);
      }
    }

    // Always record current status in developer session log
    if (user) {
      try {
        await fetch("/api/record-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            coins: coinsToSave,
            unlockedVehicles: vehiclesToSave,
            upgrades: upgradesToSave,
            loginTime: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error("Local user logging sync failed:", err);
      }
    }
  };

  const handleManualEmailLogin = async (emailInput: string) => {
    if (!emailInput || !emailInput.includes('@')) {
      triggerToast("Please enter a valid Gmail address!", "warning");
      return;
    }

    try {
      setIsSyncing(true);
      const emailLower = emailInput.trim().toLowerCase();
      const devMode = emailLower === "shashwatmishra7181@gmail.com";
      
      const parsedDisplayName = emailLower.split('@')[0];
      const mockUser = {
        email: emailLower,
        displayName: parsedDisplayName.charAt(0).toUpperCase() + parsedDisplayName.slice(1),
        photoURL: devMode ? devImage : null,
      };

      setUser(mockUser as any);
      setIsDeveloper(devMode);
      localStorage.setItem('hcr_manual_email', emailLower);

      let activeCoins = bankCoins;
      let activeVehicles = unlockedVehicles;
      const activeUpgrades = upgrades;

      if (devMode) {
        activeCoins = 99999999;
        activeVehicles = VEHICLES.map(v => v.id);
        setBankCoins(99999999);
        setUnlockedVehicles(activeVehicles);
        triggerToast("Welcome Shashwat! Premium Creative Mode Active! 👑 Free items enabled.", "success");
      } else {
        triggerToast(`Successfully connected locally under: ${emailLower} ☁️`, "success");
      }

      // Sync and log manual sign up
      try {
        await fetch("/api/record-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: emailLower,
            displayName: mockUser.displayName,
            photoURL: mockUser.photoURL,
            coins: activeCoins,
            unlockedVehicles: activeVehicles,
            upgrades: activeUpgrades,
            loginTime: new Date().toISOString(),
          }),
        });
      } catch (err) {
        console.error("Manual login log failed:", err);
      }

      setShowBypassModal(false);
    } catch (err) {
      console.error("Manual login flow error:", err);
      triggerToast("Connection failed. Please retry.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsSyncing(true);
      const resp = await loginWithGoogle();
      if (resp) {
        setToken(resp.accessToken);
        setUser(resp.user);

        const emailLower = resp.user.email?.toLowerCase() || "";
        const devMode = emailLower === "shashwatmishra7181@gmail.com";
        setIsDeveloper(devMode);

        let activeCoins = bankCoins;
        let activeVehicles = unlockedVehicles;
        let activeUpgrades = upgrades;
        let activeVehId = selectedVehicleId;
        let activeStageId = selectedStageId;

        if (devMode) {
          activeCoins = 99999999;
          activeVehicles = VEHICLES.map(v => v.id);
          setBankCoins(99999999);
          setUnlockedVehicles(activeVehicles);
          triggerToast("Welcome Shashwat! Premium Creative Mode Active! 👑 Free items enabled.", "success");
        } else {
          // Sync with custom Google Drive file
          if (resp.accessToken) {
            const cloudId = await findSaveFile(resp.accessToken);
            if (cloudId) {
              const cloudSave = await downloadSaveFile(resp.accessToken, cloudId);
              if (cloudSave) {
                activeCoins = cloudSave.bankCoins;
                activeVehicles = cloudSave.unlockedVehicles;
                activeUpgrades = cloudSave.upgrades;
                if (cloudSave.selectedVehicleId) activeVehId = cloudSave.selectedVehicleId;
                if (cloudSave.selectedStageId) activeStageId = cloudSave.selectedStageId;

                setBankCoins(activeCoins);
                setUnlockedVehicles(activeVehicles);
                setUpgrades(activeUpgrades);
                setSelectedVehicleId(activeVehId);
                setSelectedStageId(activeStageId);
                triggerToast("Welcome back! Game state restored from Google Drive! ☁️🏎️", "success");
              }
            } else {
              // Creating initial save
              await uploadSaveFile(resp.accessToken, {
                bankCoins,
                unlockedVehicles,
                upgrades,
                selectedVehicleId,
                selectedStageId
              });
              triggerToast("First-Time Setup Completed! Cloud Backup Active ☁️", "success");
            }
          }
        }

        // Post login details to central server
        try {
          await fetch("/api/record-login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: resp.user.email,
              displayName: resp.user.displayName,
              photoURL: resp.user.photoURL,
              coins: activeCoins,
              unlockedVehicles: activeVehicles,
              upgrades: activeUpgrades,
              loginTime: new Date().toISOString(),
            }),
          });
        } catch (err) {
          console.error("Failed to post server log", err);
        }
      }
    } catch (err: any) {
      console.error("Google Authenticated connection flow failed:", err);
      const errMsg = err?.message || String(err);
      if (err?.code === "auth/popup-closed-by-user" || errMsg.includes("popup-closed-by-user")) {
        triggerToast("Login setup was cancelled.", "info");
      } else {
        triggerToast("Google connection failed. Make sure popups are allowed.", "error");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await logoutFromGoogle();
      setUser(null);
      setToken(null);
      setIsDeveloper(false);

      // Reset to a clean generous state
      setBankCoins(55000);
      setUnlockedVehicles(["jeep"]);
      const initial: Record<string, UpgradeState> = {};
      VEHICLES.forEach(v => {
        initial[v.id] = { engine: 1, suspension: 1, tires: 1, fourWd: 1 };
      });
      setUpgrades(initial);
      setSelectedVehicleId("jeep");
      setSelectedStageId("countryside");
      localStorage.clear();
      triggerToast("Logged out successfully! Local progression reset.", "info");
    } catch (err) {
      console.error("Sign out session interruption:", err);
    }
  };

  // Earn coins from simulator runner
  const handleSimCoinsEarned = (amount: number) => {
    if (amount > 0) {
      const nextCoins = isDeveloper ? 99999999 : bankCoins + amount;
      setBankCoins(nextCoins);
      syncToCloud(nextCoins, unlockedVehicles, upgrades);
    }
  };

  // Purchase/Unlock a vehicle
  const handleUnlockVehicle = (v: Vehicle) => {
    if (isDeveloper) {
      if (!unlockedVehicles.includes(v.id)) {
        const nextVehicles = [...unlockedVehicles, v.id];
        setUnlockedVehicles(nextVehicles);
        setSelectedVehicleId(v.id);
        syncToCloud(99999999, nextVehicles, upgrades);
      }
      return;
    }
    if (bankCoins >= v.purchaseCost && !unlockedVehicles.includes(v.id)) {
      const nextCoins = bankCoins - v.purchaseCost;
      const nextVehicles = [...unlockedVehicles, v.id];
      setBankCoins(nextCoins);
      setUnlockedVehicles(nextVehicles);
      setSelectedVehicleId(v.id);
      syncToCloud(nextCoins, nextVehicles, upgrades);
    }
  };

  // Upgrade vehicle components
  const handleUpgradeAttribute = (attribute: keyof UpgradeState) => {
    const currentLevel = activeVehicleUpgrades[attribute];
    if (currentLevel >= activeVehicle.maxUpgradeLevel) return;

    const cost = isDeveloper ? 0 : getUpgradeCost(currentLevel);
    if (isDeveloper || bankCoins >= cost) {
      const nextCoins = isDeveloper ? bankCoins : bankCoins - cost;
      if (!isDeveloper) {
        setBankCoins(nextCoins);
      }
      setUpgrades(prev => {
        const vehicleUpgrades = { ...prev[activeVehicle.id] };
        if (!vehicleUpgrades.engine) {
          vehicleUpgrades.engine = 1;
          vehicleUpgrades.suspension = 1;
          vehicleUpgrades.tires = 1;
          vehicleUpgrades.fourWd = 1;
        }
        vehicleUpgrades[attribute] = currentLevel + 1;
        const nextUpgrades = {
          ...prev,
          [activeVehicle.id]: vehicleUpgrades
        };
        syncToCloud(nextCoins, unlockedVehicles, nextUpgrades);
        return nextUpgrades;
      });
    }
  };

  // Simulated ad watch system
  const triggerAdSimulator = () => {
    if (isWatchingAd) return;
    setIsWatchingAd(true);
    setAdCountdown(5);
    const dynamicAds = [
      "Simulating high-octane heavy monster truck tires commercial...",
      "Retro Supercharger and nitro fuel canister booster preview ad...",
      "Helicopter stabilizers and gyroscopes high-precision tuning demonstration...",
      "Solar powered solar cell battery lunar buggy video presentation..."
    ];
    setAdMessage(dynamicAds[Math.floor(Math.random() * dynamicAds.length)]);
  };

  useEffect(() => {
    if (isWatchingAd && adCountdown > 0) {
      const timer = setTimeout(() => {
        setAdCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isWatchingAd && adCountdown === 0) {
      setIsWatchingAd(false);
      const reward = 35000;
      setBankCoins(prev => prev + reward);
      triggerToast(`Sponsor watched! You earned +$${reward.toLocaleString()} Sandbox Coins!`, "success");
    }
  }, [isWatchingAd, adCountdown]);

  // Dynamic payment simulated screen
  const processFakePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fakeCard) return;
    setPurchaseStatus('processing');
    setTimeout(() => {
      setPurchaseStatus('success');
      if (paymentAmount) {
        setBankCoins(prev => prev + paymentAmount);
      }
      setTimeout(() => {
        setPurchaseStatus('idle');
        setPaymentAmount(null);
        setFakeCard('');
      }, 2000);
    }, 2500);
  };

  // Reset progress helper
  const handleResetProgress = () => {
    if (window.confirm('Kya aap progress reset karna chahte hain? Resetting will wipe all unlocks and tuning configurations.')) {
      localStorage.clear();
      setBankCoins(55000);
      setUnlockedVehicles(['jeep']);
      const initial: Record<string, UpgradeState> = {};
      VEHICLES.forEach(v => {
        initial[v.id] = { engine: 1, suspension: 1, tires: 1, fourWd: 1 };
      });
      setUpgrades(initial);
      setSelectedVehicleId('jeep');
      setSelectedStageId('countryside');
      setActivePage('play');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased pb-20 relative overflow-hidden">
      
      {/* Dynamic backdrop glows */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Main Upper Navigation Hub */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo / Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActivePage('play')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-lg">
              <Compass className="w-6 h-6 animate-spin" style={{ animationDuration: '10s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tighter text-white uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-200">
                  HILL CLIMB MULTIVERSE
                </span>
                <span className="px-1.5 py-0.2 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[8px] font-black uppercase tracking-widest">
                  PRO v1.2
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Separate Pages & Simulated Shop</p>
            </div>
          </div>

          {/* User profile / Google Authentication Controls & Game Drawer Trigger button */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
            {/* Global coins display in Navy bar */}
            <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-2xl border border-slate-800 shadow-inner">
              <Coins className="w-4 h-4 text-yellow-400 animate-pulse" />
              <span className="text-[10px] font-black text-slate-400">COINS:</span>
              <span className="font-mono text-xs font-black text-yellow-400 tracking-wider">
                {isDeveloper ? "👑 FREE WALLET" : bankCoins.toLocaleString()}
              </span>
            </div>

            {/* Google authentication controller badge */}
            {user ? (
              <div className="flex items-center gap-2 bg-slate-950/90 pl-1.5 pr-2.5 py-1 rounded-xl border border-emerald-500/25">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || "User"} className="w-6 h-6 rounded-full border border-emerald-400/30" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-black text-slate-950">
                    {user.displayName?.charAt(0) || "R"}
                  </div>
                )}
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-black text-slate-200 leading-none max-w-[85px] truncate">
                    {user.displayName || "Rider"}
                  </span>
                  <span className="text-[8px] font-bold text-emerald-400 leading-none mt-0.5">
                    {isDeveloper ? "DEVELOPER" : "CLOUD ACTIVE"}
                  </span>
                </div>
                <button 
                  onClick={handleGoogleLogout} 
                  className="ml-2.5 text-slate-500 hover:text-red-400 text-[9px] font-bold uppercase cursor-pointer"
                  title="Logout Session"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={handleGoogleLogin} 
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-amber-500/20 text-[10px] font-black text-slate-300 transition shadow-md whitespace-nowrap cursor-pointer"
                  title="Official Google Auth Sync"
                >
                  <CloudLightning className="w-3.5 h-3.5 text-amber-500" />
                  <span>Google Sync</span>
                </button>
                <button 
                  onClick={() => setShowBypassModal(true)} 
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-cyan-500/20 text-[10px] font-black text-cyan-400 transition shadow-md whitespace-nowrap cursor-pointer font-sans"
                  title="Alternative Manual Bypass Login"
                >
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Manual Login</span>
                </button>
              </div>
            )}

            {/* Optimized Side-Docked Menu Trigger Button */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 hover:border-amber-500/50 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase text-amber-500 hover:text-white transition cursor-pointer shadow-md shadow-amber-500/5 font-sans whitespace-nowrap ml-1"
              title="Open Game Drawer Navigation & Dashboard Stats"
            >
              <Menu className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>Menu</span>
              <MoreVertical className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Pages Content Area */}
      <main className="max-w-7xl mx-auto px-4 mt-6">
        
        <AnimatePresence mode="wait">
          
          {/* ================= PAGE 1: SIMULATOR / PLAY WORLD ================= */}
          {activePage === 'play' && (
            <motion.div
              key="play-page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              {/* Simulator Section */}
              <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-2xl">
                <Simulator 
                  stage={activeStage} 
                  vehicle={activeVehicle} 
                  upgrades={activeVehicleUpgrades}
                  onCoinsEarned={handleSimCoinsEarned}
                />
              </div>

              {/* Minimalist interactive gameplay tip */}
              <div className="flex items-center justify-between bg-slate-900/45 px-5 py-3 rounded-2xl border border-slate-850/60 text-[10px] text-slate-400 font-medium">
                <span className="flex items-center gap-1.5 font-sans">
                  <span className="text-amber-500 font-bold">💡 ACTIVE SIMULATOR INTEL:</span>
                  <span>Open the top <b>"Game Menu"</b> to view real-time physics telemetry & live engine upgrade stats in the <b>Dashboard</b> tab!</span>
                </span>
                <span className="font-mono text-cyan-400 font-bold hidden sm:inline">100% RESPONSIVE CALIBRATION</span>
              </div>
            </motion.div>
          )}

          {/* ================= PAGE 2: GARAGE & TUNING BOARD ================= */}
          {activePage === 'garage' && (
            <motion.div
              key="garage-page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2">
                    <Car className="w-7 h-7 text-amber-500" /> Vehicle Showroom ({VEHICLES.length} Unique Models)
                  </h2>
                  <p className="text-xs text-slate-400">Unlock retro models, hovercrafts, dragsters, and helicopters easily!</p>
                </div>
                <div className="text-xs font-mono px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
                  <span className="text-semibold text-white">{unlockedVehicles.length}</span> / {VEHICLES.length} Unlocked
                </div>
              </div>

              {/* Grid overview of the 100+ vehicles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {VEHICLES.map(v => {
                  const isUnlocked = unlockedVehicles.includes(v.id);
                  const isSelected = selectedVehicleId === v.id;

                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        if (isUnlocked) {
                          setSelectedVehicleId(v.id);
                        }
                      }}
                      className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-[190px] ${
                        isSelected
                          ? 'bg-gradient-to-br from-slate-900 to-amber-950/20 border-amber-500/50 shadow-md shadow-amber-500/5'
                          : isUnlocked 
                          ? 'bg-slate-900/60 border-slate-850 hover:bg-slate-900'
                          : 'bg-slate-950/40 border-slate-900 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: v.accentColor }}
                            />
                            <h3 className="font-extrabold text-sm uppercase text-slate-100 truncate max-w-[150px]">
                              {v.name}
                            </h3>
                          </div>
                          <span className="text-[9px] font-mono uppercase bg-slate-950 px-2 py-0.5 rounded-lg text-slate-400 font-bold border border-slate-850">
                            {v.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal line-clamp-3 mb-2">{v.description}</p>
                      </div>

                      <div className="flex justify-between items-center mt-auto pt-3 border-t border-slate-850">
                        {isSelected ? (
                          <span className="text-[10px] uppercase font-black px-3 py-1 rounded bg-amber-500 text-slate-950 tracking-wider">
                            ACTIVE RACER
                          </span>
                        ) : isUnlocked ? (
                          <span className="text-[10px] text-slate-400 font-semibold group-hover:text-amber-400 flex items-center gap-1.5 uppercase">
                            SELECT CAR <ArrowRight className="w-3 h-3 text-amber-500" />
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnlockVehicle(v);
                            }}
                            disabled={bankCoins < v.purchaseCost}
                            className={`w-full py-2 rounded-xl font-mono text-xs font-black flex items-center justify-center gap-1.5 transition ${
                              bankCoins >= v.purchaseCost
                                ? 'bg-amber-500 text-slate-950 shadow hover:bg-amber-400'
                                : 'bg-slate-900 text-slate-600 border border-slate-800'
                            }`}
                          >
                            <Lock className="w-3.5 h-3.5" /> UNLOCK: ${v.purchaseCost.toLocaleString()}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ACTIVE TUNING BOARD */}
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-widest">ACTIVE GARAGE INTERACTIVE STAGE</span>
                    <h3 className="text-lg font-black text-white uppercase flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-amber-500" /> Component Power Calibration ({activeVehicle.name})
                    </h3>
                  </div>
                  <span className="text-xs bg-slate-950 px-3 py-1 rounded-xl text-slate-400 border border-slate-850">
                    Max level of all specs: 10
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* ENGINE */}
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black text-slate-200 uppercase flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5 text-red-500" /> ENGINE SPEED
                        </span>
                        <span className="text-xs font-mono text-amber-400 font-bold">
                          LVL {activeVehicleUpgrades.engine}/10
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full mb-3 overflow-hidden border border-slate-850">
                        <div className="h-full bg-red-500" style={{ width: `${activeVehicleUpgrades.engine * 10}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 mb-4">{activeVehicle.engineDesc}</p>
                    </div>

                    {activeVehicleUpgrades.engine < 10 ? (
                      <button
                        onClick={() => handleUpgradeAttribute('engine')}
                        disabled={bankCoins < getUpgradeCost(activeVehicleUpgrades.engine)}
                        className={`w-full py-2 rounded-xl text-xs font-black text-center transition ${
                          bankCoins >= getUpgradeCost(activeVehicleUpgrades.engine)
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md'
                            : 'bg-slate-900 text-slate-600 border border-slate-850'
                        }`}
                      >
                        UPGRADE: ${getUpgradeCost(activeVehicleUpgrades.engine).toLocaleString()}
                      </button>
                    ) : (
                      <div className="text-[10px] text-center font-bold text-red-500 bg-red-500/10 py-2 rounded-xl border border-red-500/20 uppercase">MAX CALIBRATED</div>
                    )}
                  </div>

                  {/* SUSPENSION */}
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black text-slate-200 uppercase flex items-center gap-1">
                          <CircleDot className="w-3.5 h-3.5 text-cyan-400" /> SUSPENSION
                        </span>
                        <span className="text-xs font-mono text-amber-400 font-bold">
                          LVL {activeVehicleUpgrades.suspension}/10
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full mb-3 overflow-hidden border border-slate-850">
                        <div className="h-full bg-cyan-400" style={{ width: `${activeVehicleUpgrades.suspension * 10}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 mb-4">{activeVehicle.suspensionDesc}</p>
                    </div>

                    {activeVehicleUpgrades.suspension < 10 ? (
                      <button
                        onClick={() => handleUpgradeAttribute('suspension')}
                        disabled={bankCoins < getUpgradeCost(activeVehicleUpgrades.suspension)}
                        className={`w-full py-2 rounded-xl text-xs font-black text-center transition ${
                          bankCoins >= getUpgradeCost(activeVehicleUpgrades.suspension)
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md'
                            : 'bg-slate-900 text-slate-600 border border-slate-850'
                        }`}
                      >
                        UPGRADE: ${getUpgradeCost(activeVehicleUpgrades.suspension).toLocaleString()}
                      </button>
                    ) : (
                      <div className="text-[10px] text-center font-bold text-cyan-500 bg-cyan-500/10 py-2 rounded-xl border border-cyan-500/20 uppercase">MAX CALIBRATED</div>
                    )}
                  </div>

                  {/* TIRES */}
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black text-slate-200 uppercase flex items-center gap-1">
                          <CircleDot className="w-3.5 h-3.5 text-emerald-400" /> TIRES GRIP
                        </span>
                        <span className="text-xs font-mono text-amber-400 font-bold">
                          LVL {activeVehicleUpgrades.tires}/10
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full mb-3 overflow-hidden border border-slate-850">
                        <div className="h-full bg-emerald-400" style={{ width: `${activeVehicleUpgrades.tires * 10}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 mb-4">{activeVehicle.tiresDesc}</p>
                    </div>

                    {activeVehicleUpgrades.tires < 10 ? (
                      <button
                        onClick={() => handleUpgradeAttribute('tires')}
                        disabled={bankCoins < getUpgradeCost(activeVehicleUpgrades.tires)}
                        className={`w-full py-2 rounded-xl text-xs font-black text-center transition ${
                          bankCoins >= getUpgradeCost(activeVehicleUpgrades.tires)
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md'
                            : 'bg-slate-900 text-slate-600 border border-slate-850'
                        }`}
                      >
                        UPGRADE: ${getUpgradeCost(activeVehicleUpgrades.tires).toLocaleString()}
                      </button>
                    ) : (
                      <div className="text-[10px] text-center font-bold text-emerald-500 bg-emerald-500/10 py-2 rounded-xl border border-emerald-500/20 uppercase">MAX CALIBRATED</div>
                    )}
                  </div>

                  {/* 4WD */}
                  <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-850 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-black text-slate-200 uppercase flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-purple-400" /> stability control
                        </span>
                        <span className="text-xs font-mono text-amber-400 font-bold">
                          LVL {activeVehicleUpgrades.fourWd}/10
                        </span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full mb-3 overflow-hidden border border-slate-850">
                        <div className="h-full bg-purple-400" style={{ width: `${activeVehicleUpgrades.fourWd * 10}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 mb-4">{activeVehicle.fourWdDesc}</p>
                    </div>

                    {activeVehicleUpgrades.fourWd < 10 ? (
                      <button
                        onClick={() => handleUpgradeAttribute('fourWd')}
                        disabled={bankCoins < getUpgradeCost(activeVehicleUpgrades.fourWd)}
                        className={`w-full py-2 rounded-xl text-xs font-black text-center transition ${
                          bankCoins >= getUpgradeCost(activeVehicleUpgrades.fourWd)
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md'
                            : 'bg-slate-900 text-slate-600 border border-slate-850'
                        }`}
                      >
                        UPGRADE: ${getUpgradeCost(activeVehicleUpgrades.fourWd).toLocaleString()}
                      </button>
                    ) : (
                      <div className="text-[10px] text-center font-bold text-purple-500 bg-purple-500/10 py-2 rounded-xl border border-purple-500/20 uppercase">MAX CALIBRATED</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ================= PAGE 3: PLANETS & STAGES MAP GRID ================= */}
          {activePage === 'stages' && (
            <motion.div
              key="stages-page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2">
                  <Compass className="w-7 h-7 text-cyan-500" /> Planetary Race Stages (100+ Maps)
                </h2>
                <p className="text-xs text-slate-400">Choose custom worlds containing volcano peaks, gravity deficits, ice steps, and rugged hills.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {STAGES.map(s => {
                  const isSelected = selectedStageId === s.id;

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStageId(s.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between h-[180px] bg-gradient-to-br ${s.backgroundColor} ${
                        isSelected 
                          ? 'ring-2 ring-emerald-400 shadow-xl border-transparent scale-[1.02]' 
                          : 'border-slate-850 opacity-80 hover:opacity-100 hover:scale-[1.01]'
                      }`}
                    >
                      <div>
                        {/* Title and Badge */}
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h3 className="text-xs font-black text-white uppercase tracking-tight truncate max-w-[130px]">
                            {s.name}
                          </h3>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded tracking-wider uppercase ${
                            s.difficulty === 'Easy' ? 'bg-emerald-500 text-slate-950' : 
                            s.difficulty === 'Medium' ? 'bg-amber-500 text-slate-950' : 
                            'bg-rose-500 text-white'
                          }`}>
                            {s.difficulty}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 leading-normal line-clamp-3 mb-2">{s.description}</p>
                      </div>

                      <div className="mt-auto">
                        <div className="grid grid-cols-3 gap-1 text-[9px] bg-black/50 border border-white/10 rounded-lg p-1.5 font-mono text-center">
                          <div>
                            <span className="text-slate-400 block text-[8px]">GRAVITY</span>
                            <span className="text-slate-200 font-bold">{s.gravity}x</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[8px]">BONUS</span>
                            <span className="text-yellow-400 font-bold">{s.coinBonus}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[8px]">OPTIMAL</span>
                            <span className="text-emerald-400 font-bold truncate block">{s.bestVehicles[0]}</span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-2 text-center text-[9px] font-black text-emerald-400 uppercase tracking-wider bg-black/30 py-0.5 rounded">
                            ● SELECTED ACTIVE WORLD
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ================= PAGE 4: INTERACTIVE SHOP & BANK ================= */}
          {activePage === 'shop' && (
            <motion.div
              key="shop-page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2">
                    <ShoppingBag className="w-7 h-7 text-yellow-400" /> Multiverse Sponsor Bank
                  </h2>
                  <p className="text-xs text-slate-400">Earning Coins has been made strictly professional. Watch ads, or test simulated Play Store pay checkouts!</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-400 animate-bounce" />
                  <span className="text-sm font-mono font-black text-yellow-400">
                    ${bankCoins.toLocaleString()} <span className="text-[10px] text-slate-500 font-medium">COINS</span>
                  </span>
                </div>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Watch Ad Block */}
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest">SPONSOR DEALS</span>
                    <h3 className="text-lg font-black text-white uppercase mt-2 flex items-center gap-1.5">
                      <Tv className="w-5 h-5 text-blue-400" /> Watch Animated Sponsor Commercial
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">
                      Our interactive sponsors want to showcase premium vehicle items. Spend 5 seconds of mock ad viewing commercial space to earn massive coins!
                    </p>
                  </div>

                  {isWatchingAd ? (
                    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-850 text-center space-y-4 animate-pulse">
                      <div className="inline-block relative">
                        <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin" />
                        <span className="absolute inset-0 flex items-center justify-center font-mono font-bold text-xs text-amber-500">
                          {adCountdown}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Watching Dynamic Commercial...</div>
                        <p className="text-xs font-mono text-emerald-400 italic">"{adMessage}"</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={triggerAdSimulator}
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-extrabold text-xs uppercase transition tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
                    >
                      <Tv className="w-4 h-4" /> WATCH 5s AD TO EARN +$35,000 COINS
                    </button>
                  )}
                  <p className="text-[10px] text-slate-500 text-center">No real internet usage. Completely mock sandbox countdown loops.</p>
                </div>

                {/* Credit Card checkout */}
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest">PAYSTORE SIMULATOR</span>
                    <h3 className="text-lg font-black text-white uppercase mt-2 flex items-center gap-1.5">
                      <CreditCard className="w-5 h-5 text-amber-400" /> In-App Simulated Purchase
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">
                      Need 100% Sandbox freedom? Pay via our fake payment terminal to top up your balance. No real money will ever be charged.
                    </p>
                  </div>

                  {paymentAmount === null ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          setPaymentAmount(150000);
                          setPurchaseStatus('idle');
                        }}
                        className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-850 text-left transition flex flex-col justify-between"
                      >
                        <span className="text-[11px] font-black text-slate-300">Starter Coin Pack</span>
                        <div className="mt-2 text-sm font-mono font-black text-amber-400">+$150,000 COINS</div>
                        <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase">$1.99 Sandbox</span>
                      </button>

                      <button
                        onClick={() => {
                          setPaymentAmount(500000);
                          setPurchaseStatus('idle');
                        }}
                        className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-850 text-left transition flex flex-col justify-between"
                      >
                        <span className="text-[11px] font-black text-teal-400">Pro Climber Pack</span>
                        <div className="mt-2 text-sm font-mono font-black text-amber-400">+$500,000 COINS</div>
                        <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase">$4.99 Sandbox</span>
                      </button>

                      <button
                        onClick={() => {
                          setPaymentAmount(2000000);
                          setPurchaseStatus('idle');
                        }}
                        className="col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/5 to-orange-500/5 hover:from-amber-500/10 hover:to-orange-500/10 border border-amber-500/20 text-left transition flex justify-between items-center"
                      >
                        <div>
                          <span className="text-xs font-black text-amber-400 uppercase tracking-wider block">CHAMPION CALIBRATOR BANK</span>
                          <span className="text-sm font-mono font-black text-white mt-1 block">+$2,000,000 COINS</span>
                        </div>
                        <span className="text-xs font-mono font-black bg-amber-500 text-slate-950 px-2 py-1 rounded-lg uppercase">$14.99 Sandbox</span>
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={processFakePayment} className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-850">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-300 uppercase">Interactive Pay Terminal</span>
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(null)}
                          className="text-[10px] text-red-400 font-bold bg-transparent"
                        >
                          Cancel
                        </button>
                      </div>

                      {purchaseStatus === 'processing' ? (
                        <div className="text-center py-4 space-y-2">
                          <div className="w-8 h-8 rounded-full border-4 border-slate-800 border-t-amber-500 animate-spin inline-block" />
                          <p className="text-xs text-slate-400 font-bold font-mono">Simulating secure merchant approval network...</p>
                        </div>
                      ) : purchaseStatus === 'success' ? (
                        <div className="text-center py-4 space-y-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black inline-block mx-auto">✓</div>
                          <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Payment Success! +${paymentAmount?.toLocaleString()} Credited</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Mock Card Number (Write Anything)</label>
                            <input
                              type="text"
                              required
                              placeholder="4111 2222 3333 4444"
                              value={fakeCard}
                              onChange={(e) => setFakeCard(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 font-black text-xs text-white uppercase rounded-xl tracking-wider transition"
                          >
                            Pay Sandbox Price & Add Coins
                          </button>
                        </div>
                      )}
                    </form>
                  )}
                </div>

              </div>
            </motion.div>
          )}

          {/* ================= PAGE 5: WIKI & STRATEGY GUIDE ================= */}
          {activePage === 'wiki' && (
            <motion.div
              key="wiki-page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2">
                    <BookOpen className="w-7 h-7 text-amber-500" /> Pro Physics Strategy Handbook
                  </h2>
                  <p className="text-xs text-slate-400">Read detailed tuning secret specifications in English or Hindi / Hinglish.</p>
                </div>

                <div className="flex gap-1 bg-slate-900 p-1.5 border border-slate-800 rounded-xl max-w-xs shrink-0">
                  <button
                    onClick={() => setLanguage('hinglish')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition ${
                      language === 'hinglish' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Hinglish / हिंदी
                  </button>
                  <button
                    onClick={() => setLanguage('english')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition ${
                      language === 'english' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ARTICLES.map((art, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[9px] uppercase font-bold">
                        {art.category}
                      </span>
                      
                      <h3 className="text-sm font-black text-slate-100 mt-2">
                        {language === 'hinglish' ? art.hindiTitle : art.title}
                      </h3>
                      
                      <p className="text-xs text-slate-400 leading-normal mt-1.5 border-b border-dashed border-slate-800 pb-3">
                        {language === 'hinglish' ? art.hindiSummary : art.summary}
                      </p>

                      <ul className="mt-3.5 space-y-2 text-[11px] text-slate-300 leading-relaxed list-inside">
                        {(language === 'hinglish' ? art.hindiBullets : art.bullets).map((bullet, checkIdx) => (
                          <li key={checkIdx} className="text-slate-400 flex items-start gap-2">
                            <span className="text-amber-500 shrink-0 mt-1">•</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ================= PAGE 6: SETTINGS ================= */}
          {activePage === 'settings' && (
            <motion.div
              key="settings-page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-black text-white uppercase flex items-center gap-2">
                  <Settings2 className="w-7 h-7 text-purple-400" /> Game Engine Settings
                </h2>
                <p className="text-xs text-slate-400">Calibrate physical limits, toggle audio subsystems, or hard erase your localized player progression data.</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 max-w-2xl">
                
                {/* Reset Panel */}
                <div className="space-y-2 border-b border-slate-800 pb-6">
                  <h3 className="text-sm font-black text-slate-200 uppercase">Erase Progress Data</h3>
                  <p className="text-xs text-slate-400 leading-normal">
                    This action will reset your coin counts to $55,000, lock all selected extra vehicles (including the Stealth Chopper helicopter), and wipe all upgrade component statistics back to tier level 1.
                  </p>
                  <button
                    onClick={handleResetProgress}
                    className="px-4 py-2 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-transparent text-red-400 hover:text-white text-xs font-black uppercase rounded-xl transition flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" /> Hard Reset All Sandbox Progress
                  </button>
                </div>

                {/* Local environment specs */}
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-slate-200 uppercase">Interactive System Capabilities</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-slate-950 p-4 rounded-2xl border border-slate-850">
                    <div className="text-slate-500 uppercase">PLATFORM INGRESS CONTEXT:</div>
                    <div className="text-slate-200 font-bold text-right">React 19 + Tailwind v4</div>
                    <div className="text-slate-500 uppercase">COMPUTE CORE STATE:</div>
                    <div className="text-slate-200 font-bold text-right font-mono">105 VEHICLES / 104 STAGES READY</div>
                    <div className="text-slate-500 uppercase">WEB AUDIO SYNTHESIS:</div>
                    <div className="text-emerald-400 font-bold text-right flex items-center justify-end gap-1 font-mono">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> ONLINE
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* ================= PAGE 7: ABOUT DEVELOPER ================= */}
          {activePage === 'developer' && (
            <motion.div
              key="developer-page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.18 }}
              className="space-y-8"
            >
              {/* Profile Intro Banner Header */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
                <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                
                {/* Visual Circle Portrait Frame */}
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-500 to-cyan-500 rounded-full animate-spin blur-md opacity-40" style={{ animationDuration: '8s' }} />
                  <div className="relative w-40 h-40 md:w-44 md:h-44 rounded-full p-1.5 bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center">
                    <img 
                      src={devImage} 
                      alt="Shashwat Mishra" 
                      className="w-full h-full rounded-full object-cover border border-slate-700/60"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute bottom-1 right-1 bg-amber-500 text-slate-950 p-1.5 rounded-full border border-slate-900 shadow-lg">
                    <Award className="w-5 h-5 font-black" />
                  </div>
                </div>

                {/* Narrative Details */}
                <div className="text-center md:text-left space-y-3.5 max-w-3xl">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-[9px] uppercase tracking-widest font-black">
                      Sole Creator & App Architect
                    </span>
                    <h2 className="text-3xl font-black text-white tracking-tight uppercase">
                      Shashwat Mishra
                    </h2>
                  </div>

                  <p className="text-sm text-slate-300 leading-relaxed font-medium">
                    "This entire multi-world simulator companion suite, physics calibration sandbox, Google Drive background cloud sync engine, and custom reporting database was designed, modeled, and programmed line-by-line by Shashwat Mishra."
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2">
                    <div className="flex items-center gap-2.5 bg-slate-950 p-3 rounded-2xl border border-slate-850">
                      <GraduationCap className="w-5 h-5 text-cyan-400 shrink-0" />
                      <div className="text-left font-sans">
                        <div className="text-[9px] uppercase text-slate-500 font-black">Academic Profile</div>
                        <div className="text-slate-200 font-black">Class 11th Science Student</div>
                        <div className="text-slate-400 text-[10px]">Scored <span className="text-emerald-400 font-black">92%</span> in Class 10 Boards</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 bg-slate-950 p-3 rounded-2xl border border-slate-850">
                      <Heart className="w-5 h-5 text-red-400 shrink-0" />
                      <div className="text-left font-sans">
                        <div className="text-[9px] uppercase text-slate-500 font-black">Inspiration & Strength</div>
                        <div className="text-slate-200 font-black">Shri Hanuman Prasad Mishra</div>
                        <div className="text-slate-400 text-[10px]">Father & Prime Motivation Core</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multilingual Personal Intro Narrative */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-sm font-black text-amber-500 uppercase flex items-center gap-2">
                    📖 Hinglish / हिंदी संदेश
                  </h3>
                  <div className="text-xs text-slate-300 leading-relaxed space-y-3 font-sans">
                    <p>
                      <strong>Namaskar dosto!</strong> Chhatra jone me modern software engineering sikhna aur use dynamic applications me badalna mera sabse bada passion hai. Class 10th board exams me 92% marks haasil karne ke baad, maine physics simulations me research kiya.
                    </p>
                    <p>
                      Maine is pure companion app aur page router architecture ko 100% custom modules ke sath develop kiya hai. Garage pages, custom simulation page, pro calibration panel, wiki details, aur multi-drive cloud backup capabilities sab isme integrated hain.
                    </p>
                    <p>
                      Mera secure authorized developer account is app me root system access hold karta hai. Checkpoint login karte hi coins auto-unlock ho jaate hain aur vehicle prices completely bypass ho jaate hain.
                    </p>
                  </div>
                </div>

                {/* Right Column: Google cloud info and records */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
                  <h3 className="text-sm font-black text-cyan-400 uppercase flex items-center gap-2">
                    ☁️ Cloud Integration STATUS
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Status Display Area */}
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-black text-slate-500">Live Auth Status:</span>
                        {user ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            CONNECTED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            DISCONNECTED
                          </span>
                        )}
                      </div>

                      <div className="text-xs">
                        {user ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-slate-400">
                              <span>Active Pilot:</span>
                              <span className="text-slate-100 font-black">{user.displayName || "Unknown Rider"}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Email Address:</span>
                              <span className="text-slate-100 font-mono text-[10px]">{user.email}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>Account Access:</span>
                              <span className="text-amber-400 font-black">
                                {isDeveloper ? "👑 CHIEF DEVELOPER ACCESS" : "Standard Player Cloud"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-400 leading-relaxed font-sans text-[11px]">
                            Aapne Google Drive authentication link nahi kiya hai. Apne maps aur coins progression save rakhne ke liye upar diye gaye <strong>Google Sync</strong> button par click karein.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Developer Admin Dashboard */}
                    {isDeveloper && (
                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black text-slate-300 uppercase flex items-center gap-1.5">
                            <FolderSync className="w-4 h-4 text-amber-500 animate-spin" /> Player Registration Ledger (Shashwat's Console)
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono">{devLogs.length} Records</span>
                        </div>

                        {isFetchingLogs ? (
                          <div className="flex items-center gap-2 justify-center py-6 text-xs text-slate-400">
                            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" /> Connecting securely to local logs database file...
                          </div>
                        ) : devLogs.length === 0 ? (
                          <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 text-center text-[11px] text-slate-500">
                            Central logs database is currently empty.
                          </div>
                        ) : (
                          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {devLogs.map((log: any, lIdx: number) => (
                              <div key={lIdx} className="bg-slate-950 p-3 rounded-xl border border-slate-850 text-[11px] font-mono space-y-1">
                                <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-1.5">
                                    {log.photoURL && <img src={log.photoURL} className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />}
                                    <span className="text-slate-200 font-bold max-w-[120px] truncate">{log.displayName}</span>
                                  </div>
                                  <span className="text-[10px] text-amber-400 font-black">{log.coins === 99999999 ? "👑 DEV WALLET" : `$${log.coins?.toLocaleString()}`}</span>
                                </div>
                                <div className="text-[9px] text-slate-500 truncate flex justify-between">
                                  <span>{log.email}</span>
                                  <span className="text-[8px] text-slate-600">{new Date(log.loginTime).toLocaleDateString()}</span>
                                </div>
                                <div className="text-[9px] text-slate-400 flex flex-wrap gap-1 mt-1">
                                  <span className="px-1 py-0.2 rounded bg-slate-900 border border-slate-800 text-teal-400">
                                    Vehicles: {Array.isArray(log.unlockedVehicles) ? log.unlockedVehicles.length : 1}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

      </main>

      {/* Global Quick Bottom Footer */}
      <footer className="mt-20 border-t border-slate-900 py-6 text-center text-[10px] text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center flex-col sm:flex-row gap-2">
          <p>Physics simulation based on real 2D dynamics model equations.</p>
          <p className="font-mono">Hill Climb Multiverse Build v1.2.0 • Play Store Mock Terminal</p>
        </div>
      </footer>

      {/* Dynamic Native Game Portal Notification Overlay */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 flex gap-3 items-start cursor-pointer hover:bg-slate-900/98 transition"
            onClick={() => setToast(null)}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              toast.type === 'error' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
              toast.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
              'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}>
              {toast.type === 'success' ? <Award className="w-5 h-5" /> : 
               toast.type === 'error' ? <CloudLightning className="w-5 h-5 text-rose-400" /> :
               toast.type === 'warning' ? <ShieldCheck className="w-5 h-5 text-amber-400" /> :
               <RefreshCw className="w-5 h-5 text-cyan-400" />}
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <h4 className="text-[9px] font-black uppercase text-slate-500 tracking-widest font-mono">
                {toast.type === 'success' ? 'SUCCESS ALERT' : 
                 toast.type === 'error' ? 'SYSTEM ERROR' :
                 toast.type === 'warning' ? 'SECURITY ALERT' :
                 'GAME PORTAL ALERT'}
              </h4>
              <p className="text-[11px] font-semibold text-slate-200 mt-1 leading-normal font-sans">
                {toast.message}
              </p>
            </div>
            <button 
              className="text-slate-500 hover:text-slate-300 text-xs font-bold font-mono px-1 shrink-0 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setToast(null);
              }}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Manual/Bypass Sign-In Glassmorphism Modal */}
      <AnimatePresence>
        {showBypassModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden"
            >
              {/* Abs decorative circles */}
              <div className="absolute -top-12 -left-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Manual Bypass Login</h3>
                </div>
                <button 
                  onClick={() => setShowBypassModal(false)}
                  className="text-slate-400 hover:text-white font-mono text-[10px] uppercase px-2 py-0.5 rounded-lg border border-slate-800 hover:border-slate-750 font-bold transition cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  If the Google sign-in window is blocked or fails to load, please enter your Gmail address below to establish a secure offline cloud sync session and backup your coins and unlocks locally!
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 font-mono tracking-widest block">
                    Your Gmail Address:
                  </label>
                  <input
                    type="email"
                    placeholder="Enter developer or your authorized Gmail"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-2xl px-4 py-3 text-slate-200 text-xs font-semibold focus:outline-none transition font-sans"
                    required
                  />
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-850 space-y-1">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-wide flex items-center gap-1">
                    👑 SHASHWAT ACCESS ACTIVE
                  </p>
                  <p className="text-[9.5px] font-medium text-slate-400 leading-normal font-sans">
                    Logging with the correct authorized developer email instantly activates root administrative settings, unlocking every vehicle & free shopping!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleManualEmailLogin(manualEmail)}
                  disabled={isSyncing}
                  className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black uppercase text-xs tracking-wider py-3.5 rounded-2xl shadow-lg transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSyncing ? "Connecting Secure Session..." : "🚀 Establish Save Session"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-out Sidebar Drawer Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Dark blur backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 cursor-pointer"
            />

            {/* Sidebar drawer body */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed right-0 top-0 h-full w-[320px] bg-slate-900 border-l border-slate-800 p-5 shadow-2xl z-50 flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Compass className="w-5 h-5 text-amber-500 animate-spin" style={{ animationDuration: '10s' }} />
                    <span className="text-xs font-black text-white tracking-widest uppercase font-mono">GAME CONSOLE</span>
                  </div>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                    title="Close Menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tab Switcher */}
                <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-2xl border border-slate-850/80">
                  <button
                    onClick={() => setDrawerTab('navigation')}
                    className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition cursor-pointer ${
                      drawerTab === 'navigation'
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    🧭 PORTALS
                  </button>
                  <button
                    onClick={() => setDrawerTab('dashboard')}
                    className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                      drawerTab === 'dashboard'
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    📊 DASHBOARD
                  </button>
                </div>

                {drawerTab === 'navigation' ? (
                  /* TAB 1: Navigation Links inside Drawer */
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest font-mono pl-1">Game Portals:</span>
                    
                    <button
                      onClick={() => { setActivePage('play'); setIsMenuOpen(false); }}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition ${
                        activePage === 'play'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg font-black'
                          : 'text-slate-300 hover:text-white hover:bg-slate-950 border border-transparent hover:border-slate-850'
                      }`}
                    >
                      <span className="text-base text-purple-400">🎮</span>
                      <span>Play World</span>
                    </button>

                    <button
                      onClick={() => { setActivePage('garage'); setIsMenuOpen(false); }}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition ${
                        activePage === 'garage'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg font-black'
                          : 'text-slate-300 hover:text-white hover:bg-slate-950 border border-transparent hover:border-slate-850'
                      }`}
                    >
                      <span className="text-base text-amber-400">🚗</span>
                      <span>Garage ({unlockedVehicles.length})</span>
                    </button>

                    <button
                      onClick={() => { setActivePage('stages'); setIsMenuOpen(false); }}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition ${
                        activePage === 'stages'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg font-black'
                          : 'text-slate-300 hover:text-white hover:bg-slate-950 border border-transparent hover:border-slate-850'
                      }`}
                    >
                      <span className="text-base text-sky-400">🗺️</span>
                      <span>100+ Maps</span>
                    </button>

                    <button
                      onClick={() => { setActivePage('shop'); setIsMenuOpen(false); }}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition ${
                        activePage === 'shop'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg font-black'
                          : 'text-yellow-400 hover:text-yellow-300 hover:bg-slate-950 border border-transparent hover:border-slate-850'
                      }`}
                    >
                      <span className="text-base text-yellow-400">💰</span>
                      <span>Shop & Bank</span>
                    </button>

                    <button
                      onClick={() => { setActivePage('wiki'); setIsMenuOpen(false); }}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition ${
                        activePage === 'wiki'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg font-black'
                          : 'text-slate-300 hover:text-white hover:bg-slate-950 border border-transparent hover:border-slate-850'
                      }`}
                    >
                      <span className="text-base text-green-400">📚</span>
                      <span>Strategy Guide</span>
                    </button>

                    <button
                      onClick={() => { setActivePage('settings'); setIsMenuOpen(false); }}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition ${
                        activePage === 'settings'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg font-black'
                          : 'text-slate-300 hover:text-white hover:bg-slate-950 border border-transparent hover:border-slate-850'
                      }`}
                    >
                      <span className="text-base text-gray-400">⚙️</span>
                      <span>Settings</span>
                    </button>

                    <button
                      onClick={() => { setActivePage('developer'); setIsMenuOpen(false); }}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition ${
                        activePage === 'developer'
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg font-black'
                          : 'text-cyan-400 hover:text-cyan-300 hover:bg-slate-950 border border-cyan-500/10'
                      }`}
                    >
                      <span className="text-base text-cyan-400">👨‍💻</span>
                      <span>About Developer</span>
                    </button>
                  </div>
                ) : (
                  /* TAB 2: Live Dashboard Panel containing telemetry, upgrade stats and rules */
                  <div className="flex flex-col gap-4 font-sans text-xs animate-fadeIn">
                    
                    {/* Active Configuration Selection */}
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 pb-1.5 border-b border-slate-900">
                        <span>🚗 CURRENT SIM SELECTION</span>
                      </div>
                      <div className="text-[11px] text-slate-300 leading-normal mb-3 bg-slate-900/60 p-3 rounded-xl border border-slate-850/60 font-medium">
                        <div>Active Vehicle: <b className="text-amber-400 uppercase font-black">{activeVehicle.name}</b></div>
                        <div className="mt-1">Active Map: <b className="text-cyan-400 uppercase font-black">{activeStage.name}</b></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setActivePage('garage'); setIsMenuOpen(false); }}
                          className="py-2 text-[10px] font-black uppercase text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition text-center cursor-pointer font-sans"
                        >
                          Change Car
                        </button>
                        <button
                          onClick={() => { setActivePage('stages'); setIsMenuOpen(false); }}
                          className="py-2 text-[10px] font-black uppercase text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition text-center cursor-pointer font-sans"
                        >
                          Select Map
                        </button>
                      </div>
                    </div>

                    {/* Active Vehicle Stats Card */}
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850">
                      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-900">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-amber-500" /> ACTIVE TELEMETRY
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[9px] font-bold uppercase font-mono">
                          {activeVehicle.name}
                        </span>
                      </div>
                      
                      <div className="space-y-3 pt-1">
                        <div>
                          <div className="flex justify-between text-[10px] font-mono mb-1">
                            <span className="text-slate-500 font-bold">ENGINE POWER</span>
                            <span className="text-amber-400 font-bold">LVL {activeVehicleUpgrades.engine}/10</span>
                          </div>
                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-amber-400 h-full rounded-full transition-all duration-300" style={{ width: `${activeVehicleUpgrades.engine * 10}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[10px] font-mono mb-1">
                            <span className="text-slate-500 font-bold">SUSPENSION</span>
                            <span className="text-cyan-400 font-bold">LVL {activeVehicleUpgrades.suspension}/10</span>
                          </div>
                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-cyan-400 h-full rounded-full transition-all duration-300" style={{ width: `${activeVehicleUpgrades.suspension * 10}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[10px] font-mono mb-1">
                            <span className="text-slate-500 font-bold">TIRE TREADS</span>
                            <span className="text-emerald-400 font-bold">LVL {activeVehicleUpgrades.tires}/10</span>
                          </div>
                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-400 h-full rounded-full transition-all duration-300" style={{ width: `${activeVehicleUpgrades.tires * 10}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[10px] font-mono mb-1">
                            <span className="text-slate-500 font-bold">4WD ROTATION</span>
                            <span className="text-purple-400 font-bold">LVL {activeVehicleUpgrades.fourWd}/10</span>
                          </div>
                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-purple-400 h-full rounded-full transition-all duration-300" style={{ width: `${activeVehicleUpgrades.fourWd * 10}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Active Stage Parameters Card */}
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850">
                      <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-slate-900">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} /> STAGE METRICS
                        </span>
                        <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 text-[9px] font-bold uppercase font-mono">
                          {activeStage.name}
                        </span>
                      </div>

                      <div className="space-y-2 font-mono text-[10.5px]">
                        <div className="flex justify-between border-b border-slate-900/60 pb-1">
                          <span className="text-slate-500 uppercase">ENVIRONMENT</span>
                          <span className="text-slate-200 font-bold">{activeStage.name}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-900/60 pb-1">
                          <span className="text-slate-500 uppercase">GRAVITY</span>
                          <span className="text-cyan-400 font-bold">{activeStage.gravity}x Earth</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-900/60 pb-1">
                          <span className="text-slate-500 uppercase">COIN REWARD</span>
                          <span className="text-yellow-400 font-bold">+{activeStage.coinBonus} bonus</span>
                        </div>
                        <div className="flex justify-between pb-0.5">
                          <span className="text-slate-500 uppercase">DIFFICULTY</span>
                          <span className="text-red-400 font-bold">{activeStage.difficulty}</span>
                        </div>
                      </div>

                      <div className="mt-3 bg-slate-905 p-2 rounded-xl text-[9.5px] text-slate-400 border border-slate-900 leading-normal">
                        💡 <span className="text-slate-200 font-bold">Tip:</span> {activeStage.tips}
                      </div>
                    </div>

                    {/* Quick Guide Card (Only on PC) */}
                    {isPC && (
                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-[10.5px] leading-normal text-slate-300">
                        <div className="flex items-center gap-1 text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1.5">
                          <Settings2 className="w-3.5 h-3.5 text-purple-400" /> PHYSICS CONTROLS
                        </div>
                        <div className="space-y-2 text-[10px] text-slate-400">
                          <p>
                            Press <kbd className="bg-slate-900 text-white px-1 py-0.5 rounded border border-slate-800 font-mono">D</kbd> or <kbd className="bg-slate-900 text-white px-1 py-0.5 rounded border border-slate-800 font-mono">➡</kbd> to apply engine gas force.
                          </p>
                          <p>
                            Press <kbd className="bg-slate-900 text-white px-1 py-0.5 rounded border border-slate-800 font-mono font-bold">A</kbd> or <kbd className="bg-slate-900 text-white px-1 py-0.5 rounded border border-slate-800 font-mono">⬅</kbd> to apply braking/anti-gravity flip.
                          </p>
                          <p className="bg-slate-900/40 p-1.5 rounded text-[9.5px] border border-slate-900 leading-normal">
                            ⚙️ <b className="text-slate-300">Helicopter Rotors:</b> Hold Gas to generate vertical lift thrust. Rotor RPM accelerates dynamically!
                          </p>
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>

              {/* Drawer footer metadata */}
              <div className="border-t border-slate-800 pt-3 mt-6 text-center space-y-1 text-sans">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">CALIBRATION ENGINE ACTIVE</span>
                <div className="text-[9.5px] text-slate-400 truncate bg-slate-950 py-1 px-2 rounded-xl border border-slate-850 font-mono">
                  {user ? user.email : "Guest Local Sandbox"}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
