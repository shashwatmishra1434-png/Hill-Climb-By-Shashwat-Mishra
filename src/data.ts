export interface Vehicle {
  id: string;
  name: string;
  type: string;
  description: string;
  engineDesc: string;
  suspensionDesc: string;
  tiresDesc: string;
  fourWdDesc: string;
  baseCost: number;
  unlockedByDefault: boolean;
  maxUpgradeLevel: number;
  purchaseCost: number;
  accentColor: string;
}

export interface Stage {
  id: string;
  name: string;
  description: string;
  gravity: number; // multiplier of standard
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Extreme';
  coinBonus: string;
  bestVehicles: string[];
  tips: string;
  backgroundColor: string;
}

export interface UpgradeState {
  engine: number;
  suspension: number;
  tires: number;
  fourWd: number;
}

// Core Handcrafted Vehicles
const CORE_VEHICLES: Vehicle[] = [
  {
    id: 'jeep',
    name: 'Hill Climber (Jeep)',
    type: 'Starter 4x4',
    description: 'The standard issue off-road jeep. It is well-balanced, has good 4WD, but lacks sheer speed and high-level shock absorption.',
    engineDesc: 'Increases horsepower to mount vertical slopes easily.',
    suspensionDesc: 'Improves stability and dampens hard landings.',
    tiresDesc: 'Improves tire compound for grip on dry dirt and gravel.',
    fourWdDesc: 'Distributes torque equally to front and rear wheels for steep climbs.',
    baseCost: 0,
    unlockedByDefault: true,
    maxUpgradeLevel: 10,
    purchaseCost: 0,
    accentColor: '#fbbf24', // Amber
  },
  {
    id: 'monster',
    name: 'Monster Truck',
    type: 'Heavy Crusher',
    description: 'Comes with gigantic tires. Crushes obstacles, leaps through deep valleys, and absorbs heavy shock extremely well, but consumes fuel very quickly.',
    engineDesc: 'High torque V8 engine upgrades to drag the heavy chassis.',
    suspensionDesc: 'Colossal coilover shock absorbers for massive jumps.',
    tiresDesc: 'Massive high-traction tread tires to crawl over absolute rubble.',
    fourWdDesc: 'Strengthens axle gear ratio to rotationally propel both giant wheels.',
    baseCost: 15000,
    unlockedByDefault: false,
    maxUpgradeLevel: 10,
    purchaseCost: 15000,
    accentColor: '#ef4444', // Red
  },
  {
    id: 'motocross',
    name: 'Motocross Bike',
    type: 'Air Flip Specialist',
    description: 'Extremely lightweight and fast. The ultimate choice for aerial flips and coin grinding, but offers zero protection for the driver’s head.',
    engineDesc: 'Light high-revving 2-stroke engine that responds instantly.',
    suspensionDesc: 'Flexible telescopic forks to cushion land impacts.',
    tiresDesc: 'Spiked tires to claw into loose mud and sand surfaces.',
    fourWdDesc: 'Upgrades chain-drive tension and rear-wheel anti-slip balance.',
    baseCost: 20000,
    unlockedByDefault: false,
    maxUpgradeLevel: 10,
    purchaseCost: 20000,
    accentColor: '#10b981', // Emerald
  },
  {
    id: 'racecar',
    name: 'Race Car',
    type: 'Downforce Racer',
    description: 'Incredibly fast and aerodynamically active. Features high downforce that pushes it down at speed, but has very low ground clearance.',
    engineDesc: 'Turbocharged racetrack engine for insane straight-line speeds.',
    suspensionDesc: 'Stiff racing springs to maintain optimal low-height grip.',
    tiresDesc: 'Soft sticky slick compound for maximum friction on clean roads.',
    fourWdDesc: 'Upgrades electronic rear spoiler downforce stabilizer.',
    baseCost: 50000,
    unlockedByDefault: false,
    maxUpgradeLevel: 10,
    purchaseCost: 50000,
    accentColor: '#3b82f6', // Blue
  },
  {
    id: 'superjeep',
    name: 'Super Jeep',
    type: 'All-Terrain Shield',
    description: 'A heavily armored version of the Jeep. Equipped with a sturdy Roll Cage that protects your driver from breaking his neck on single roll-overs!',
    engineDesc: 'Modern dual-overhead cam diesel engine with thick torque.',
    suspensionDesc: 'Fully independent double-wishbone premium gas shocks.',
    tiresDesc: 'Kevlar-reinforced radial off-road performance tires.',
    fourWdDesc: 'Electronic locking differentials to prevent absolute wheel spin.',
    baseCost: 75000,
    unlockedByDefault: false,
    maxUpgradeLevel: 10,
    purchaseCost: 100000,
    accentColor: '#8b5cf6', // Violet
  },
  {
    id: 'helicopter',
    name: 'Stealth Chopper (Helicopter)',
    type: 'Flyer/Gravity Defier',
    description: 'Equipped with a spinning rotor and tail fin! Press throttle/Gas to generate upward lift and fly over absolute chasms, ignore normal slopes.',
    engineDesc: 'Helicopter turboshaft upgrades to lift heavy steel chassis.',
    suspensionDesc: 'Skid-pad shock dampers to cushion sudden hard drops.',
    tiresDesc: 'Upgrades rear rotor blade efficiency for forward thrust.',
    fourWdDesc: 'Main rotor stabilizer gyroscope to maintain perfect flight posture.',
    baseCost: 120000,
    unlockedByDefault: false,
    maxUpgradeLevel: 10,
    purchaseCost: 150000,
    accentColor: '#06b6d4', // Cyan
  }
];

// Generate 100+ vehicles programmatically for complete richness
const generateVehicles = (): Vehicle[] => {
  const result = [...CORE_VEHICLES];
  const prefixes = ['Hyper', 'Cyber', 'Vintage', 'Retro', 'Mega', 'Rocket', 'Eco', 'Stealth', 'Giga', 'Desert', 'Ocean', 'Cosmic', 'Magnetic', 'Rusty', 'Titan', 'Drift'];
  const nouns = ['Cruiser', 'Buggy', 'Roamer', 'Interceptor', 'Crawler', 'Racer', 'Hauler', 'Scout', 'Slasher', 'Prowler', 'Wrecker', 'Voyager', 'Phantom', 'Tractor', 'Speedster', 'Beast'];
  const types = ['Hill Specialist', 'Off-road Crawler', 'Drift Tuner', 'Eco Hybrid Vehicle', 'Massive Cargo Truck', 'All-weather Buggy', 'Lunar Rover Concept', 'Heavy Cargo Utility'];

  for (let i = 1; i <= 100; i++) {
    const prefix = prefixes[i % prefixes.length];
    const noun = nouns[(i * 3) % nouns.length];
    const type = types[(i * 2) % types.length];
    const cost = Math.floor(12000 + i * 1850);
    const id = `extra_car_${i}`;
    
    // Choose nice color
    const hue = (i * 27) % 360;
    const accentColor = `hsl(${hue}, 85%, 55%)`;

    result.push({
      id,
      name: `${prefix} ${noun} v${i}`,
      type,
      description: `Custom production line ${prefix} model ${i}. Optimized built for hill runs, steep slopes, and dynamic suspension tuning.`,
      engineDesc: 'Increases engine power and response limits.',
      suspensionDesc: 'Improves shock stiffness and prevents flipping forward.',
      tiresDesc: 'Boosts rubber traction compound coefficient.',
      fourWdDesc: 'Improves stability control systems.',
      baseCost: cost,
      unlockedByDefault: false,
      maxUpgradeLevel: 10,
      purchaseCost: cost,
      accentColor
    });
  }
  return result;
};

export const VEHICLES: Vehicle[] = generateVehicles();

// Core stages
const CORE_STAGES: Stage[] = [
  {
    id: 'countryside',
    name: 'Countryside',
    description: 'Standard grassy hills with mild slopes and plenty of fuel. The perfect starting ground to practice gas control and landing flips.',
    gravity: 1.0,
    difficulty: 'Easy',
    coinBonus: '1.0x (Standard)',
    bestVehicles: ['Hill Climber', 'Super Jeep'],
    tips: 'Watch your speed when cresting hills; flying too high might waste fuel unless you control the mid-air angle.',
    backgroundColor: 'from-green-950 to-emerald-900',
  },
  {
    id: 'desert',
    name: 'Desert',
    description: 'Huge rolling sand dunes with sparse vegetation. Drag is high and sand dunes can be unexpectedly steep, requiring robust tire traction.',
    gravity: 1.0,
    difficulty: 'Medium',
    coinBonus: '1.2x Coins',
    bestVehicles: ['Monster Truck', 'Race Car'],
    tips: 'Upgrade Tires first here, or your wheels will spin uselessly on the soft yellow sand dunes.',
    backgroundColor: 'from-amber-950 to-orange-950',
  },
  {
    id: 'arctic',
    name: 'Arctic',
    description: 'Pure ice and snowy chasms. Extremely slippery. Speed and brakes behave unpredictably, causing vehicles to slip back down hills.',
    gravity: 1.0,
    difficulty: 'Hard',
    coinBonus: '1.5x Coins',
    bestVehicles: ['Super Jeep', 'Jeep (with maxed Tires)'],
    tips: 'Drive slow and apply gentle, pulsing gas inputs. Slick tires here will keep you sliding backwards.',
    backgroundColor: 'from-cyan-950 to-blue-950',
  },
  {
    id: 'moon',
    name: 'The Moon',
    description: 'Very low gravity environment! Any small jump launches you into orbit. Amazing for performing multiple consecutive air flips for massive bonus coins!',
    gravity: 0.18,
    difficulty: 'Easy',
    coinBonus: '2.5x Air-time Coins',
    bestVehicles: ['Motocross Bike', 'Monster Truck'],
    tips: 'Maintain low speed when you need to land on a fuel canister, but whenever you fly, do continuous spins for gigantic flip bonuses!',
    backgroundColor: 'from-slate-950 to-indigo-950',
  }
];

// Generate 100+ stages programmatically
const generateStages = (): Stage[] => {
  const result = [...CORE_STAGES];
  const stagePrefixes = ['Volcano', 'Mount', 'Cyber', 'Neon', 'Pluto', 'Canyon', 'Sky', 'Nuclear', 'Slippery', 'Forest', 'Ocean', 'Stellar', 'Rocky', 'Raging', 'Mystic', 'Retro'];
  const stageNouns = ['Peak', 'Valley', 'Highway', 'Pass', 'Crater', 'Wasteland', 'Abyss', 'Chasm', 'Ridge', 'Tundra', 'Rollercoaster', 'Desert', 'Cove', 'Ruins', 'Plaza', 'Dunes'];
  const difficulties: ('Easy' | 'Medium' | 'Hard' | 'Extreme')[] = ['Easy', 'Medium', 'Hard', 'Extreme'];

  for (let i = 1; i <= 100; i++) {
    const prefix = stagePrefixes[i % stagePrefixes.length];
    const noun = stageNouns[(i * 2) % stageNouns.length];
    const difficulty = difficulties[(i * 3) % difficulties.length];
    const id = `extra_stage_${i}`;

    const grav = parseFloat((0.4 + (i % 8) * 0.22).toFixed(2));
    const bonus = (1.0 + (i * 0.05)).toFixed(1);

    // Dynamic clean tailwind gradient colors
    const colors = [
      'from-stone-900 to-red-950',
      'from-emerald-950 to-sky-950',
      'from-slate-900 to-zinc-950',
      'from-pink-950 to-purple-950',
      'from-fuchsia-950 to-stone-900',
      'from-indigo-950 to-rose-950',
      'from-cyan-900 to-emerald-950'
    ];
    const backgroundColor = colors[i % colors.length];

    result.push({
      id,
      name: `${prefix} ${noun} ${i}`,
      description: `An exotic planetary sector situated in the ${prefix} region. High gravity variance with challenging procedurally-spaced terrain steps.`,
      gravity: grav,
      difficulty,
      coinBonus: `${bonus}x Coins`,
      bestVehicles: ['Monster Truck', 'Super Jeep'],
      tips: `Aim for optimized rotational control; check your speed before jumping wide gaps and hills.`,
      backgroundColor
    });
  }
  return result;
};

export const STAGES: Stage[] = generateStages();

// Calculation formula for custom upgrades: Upgrading cost increases exponentially
// level 1 cost = baseCost * 1.5, level 2 = baseCost * 2.2, etc.
// For quick reference in the calculator:
export const getUpgradeCost = (currentLevel: number): number => {
  if (currentLevel >= 10) return 0;
  // Dynamic cost step table typical of Hill Climb Racing
  const costs = [3000, 6000, 12000, 24000, 48000, 90000, 150000, 250000, 400000, 650000];
  return costs[currentLevel];
};

export interface GuideArticle {
  title: string;
  hindiTitle: string;
  category: 'Tricks' | 'Economy' | 'Upgrades';
  summary: string;
  hindiSummary: string;
  bullets: string[];
  hindiBullets: string[];
}

export const ARTICLES: GuideArticle[] = [
  {
    title: 'How to farm unlimited coins on the Moon',
    hindiTitle: 'Moon Stage Par Unlimited Coins Kaise Farm Karein',
    category: 'Economy',
    summary: 'The Moon stage is the absolute goldmine of the game due to 1/6th Earth gravity. Air-time is handsomely rewarded.',
    hindiSummary: 'Moon stage game ki sabse badi ti तिजोरी hai kyunki yahan gravity bahot kam hai, jis se gaadi hawa me rehti hai.',
    bullets: [
      'Use the Motocross Bike. It has low weight and flips incredibly fast.',
      'Do a Backflip or Frontflip in every jump. Each full flip grants +1000 to +3000 coins instantly!',
      'Ensure you hold Gas to level the bike horizontal before hitting the ground to avoid neck flip impacts.',
      'Do not upgrade engine to max because too much speed will make you overshoot fuel canisters.',
    ],
    hindiBullets: [
      'Motocross Bike ka use karein. Yeh halki hoti hai aur hawa me jaldi ghoomti hai.',
      'Har jump me Backflip ya Frontflip lagayein. Har flip par +1000 se +3000 coins milenge.',
      'Zameen par girne se pehle bike ko seedha kar lein taki neck na broke ho.',
      'Engine ko shuru me bahut jyada upgrade na karein, nahi toh fuel can skip ho jayega.',
    ]
  },
  {
    title: 'Vehicle Upgrade Strategy',
    hindiTitle: 'Gaadi Ko Sahi Se Upgrade Karne Ki Strategy',
    category: 'Upgrades',
    summary: 'Do not waste coins upgrading everything equally. Prioritize according to stage physics.',
    hindiSummary: 'Saare paise sabhi cheezo par barabar mat kharch karein. Stage ke hisab se upgrade karein.',
    bullets: [
      '4WD (Four-Wheel Drive) is the single most important upgrade for steep hill climbing as it improves absolute power distribution.',
      'Tires are critical for Arctic and Desert. Upgrading tires reduces spinning in place.',
      'Suspension prevents high-speed bouncing which can flip your car on flat highways.',
      'Keep your Engine up to date for vertical hill climbs where gravity fights you directly.',
    ],
    hindiBullets: [
      '4WD upgrade sabse zaroori hai dhalan chadhne ke liye.',
      'Tires ko Arctic aur Desert stage me sabse pehle upgrade karein taaki slip na ho.',
      'Suspension gaadi ko uchalne se rokta hai, khaas kar high speed me.',
      'Engine upgrade karein taaki badi dhalan par speed banayi ja sake.',
    ]
  },
  {
    title: 'The Art of Flipping and Saving Fuel',
    hindiTitle: 'Fuel Bachane aur Flips Karne Ka Sahi Tareeqa',
    category: 'Tricks',
    summary: 'Mastering throttle controls in mid-air and engine brake management defines high scorers.',
    hindiSummary: 'Hawa me gaadi control karna aur fuel can tak sahi se pahunchna hi high score ki kunji hai.',
    bullets: [
      'Press Gas (Accelerator) in mid-air to rotate the nose of the car upwards.',
      'Press Brake (Reverse) in mid-air to pull the nose of the car downwards.',
      'When flying over hills, release the gas pedal! Running the engine in pure flight wastes valuable fuel.',
      'Keep your eye strictly on distance markers to predict when a red fuel canister is coming up.',
    ],
    hindiBullets: [
      'Hawa me Accelerator (Gas) dabane se gaadi ka aage ka hissa upar uthta hai.',
      'Hawa me Brake dabane se gaadi ka aage ka hissa neeche jhukta hai.',
      'Jab gaadi hawa me ho, toh speed pedal chhod dein kyunki hawa me accelerate karne se extra fuel waste hota hai.',
      'Lal fuel can aane wala hai yeh dekhne ke liye fuel meter par dhayan rakhein.',
    ]
  }
];
