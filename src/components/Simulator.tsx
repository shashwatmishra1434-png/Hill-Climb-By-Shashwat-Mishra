import React, { useRef, useEffect, useState } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Flame, Zap, Award } from 'lucide-react';
import { Stage, Vehicle, UpgradeState } from '../data';

interface SimulatorProps {
  stage: Stage;
  vehicle: Vehicle;
  upgrades: UpgradeState;
  onCoinsEarned?: (amount: number) => void;
}

// Low-level Web Audio synthesizer for nostalgic engine rumbles & coin collect sounds
class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  public enabled: boolean = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.enabled = true;
      this.startEngine();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      this.enabled = false;
    }
  }

  private startEngine() {
    if (!this.ctx) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.filter = this.ctx.createBiquadFilter();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

      this.filter.type = 'bandpass';
      this.filter.frequency.setValueAtTime(140, this.ctx.currentTime);
      this.filter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      this.engineOsc.connect(this.filter);
      this.filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineGain.gain.setValueAtTime(0.005, this.ctx.currentTime);
      this.engineOsc.start();
    } catch {
      // Ignored
    }
  }

  setEngineRPM(rpm: number, isRacing: boolean = true, isMoving: boolean = true) {
    if (!this.enabled || !this.ctx || !this.engineOsc || !this.engineGain) return;
    try {
      if (!isRacing) {
        // Not racing: silence the engine noise completely
        this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
        return;
      }

      // If racing but not moving, play dynamic idling sound (low rumble chug)
      let effectiveRpm = rpm;
      if (!isMoving) {
        const timeFactor = this.ctx.currentTime * 16; // 16 Hz cylinder rate
        effectiveRpm = 0.02 + 0.015 * Math.sin(timeFactor);
      }

      // rpm ranges from 0.0 (idle) to 1.0 (max)
      const targetFreq = 42 + effectiveRpm * 135; // 42Hz to 177Hz
      this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);

      const targetGain = isMoving
        ? (0.01 + effectiveRpm * 0.065) // fully throttled/moving
        : (0.005 + effectiveRpm * 0.015); // gentle low rumble idling

      this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);

      if (this.filter) {
        const targetFilterFreq = isMoving
          ? (130 + effectiveRpm * 260)
          : (85 + effectiveRpm * 40);
        this.filter.frequency.setTargetAtTime(targetFilterFreq, this.ctx.currentTime, 0.1);
      }
    } catch {
      // Ignored
    }
  }

  playCoinSound() {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, this.ctx.currentTime); // B5 note
      osc.frequency.setValueAtTime(1318.51, this.ctx.currentTime + 0.06); // E6 note

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
    } catch {
      // Ignored
    }
  }

  playFuelSound() {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, this.ctx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch {
      // Ignored
    }
  }

  playCrashSound() {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.5);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.7);
    } catch {
      // Ignored
    }
  }

  stop() {
    try {
      if (this.engineOsc) this.engineOsc.stop();
      if (this.ctx) this.ctx.close();
    } catch {}
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.filter = null;
  }
}

export const Simulator: React.FC<SimulatorProps> = ({ stage, vehicle, upgrades, onCoinsEarned }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioSynthRef = useRef<AudioSynthesizer | null>(null);
  const hasStartedRacingRef = useRef(false);

  // Game stats state
  const [coins, setCoins] = useState(0);
  const [distance, setDistance] = useState(0);
  const [fuel, setFuel] = useState(100);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState<'fuel' | 'crash' | 'none'>('none');
  const [isMuted, setIsMuted] = useState(true);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('hcr_high_score') || '0', 10);
  });
  const [keyState, setKeyState] = useState<{ gas: boolean; brake: boolean }>({ gas: false, brake: false });

  // Game mechanics setup (all live values are stored inside refs to prevent re-renders on game loop)
  const statsRef = useRef({
    coins: 0,
    distance: 0,
    fuel: 100,
    isGameOver: false,
    reason: 'none' as 'fuel' | 'crash' | 'none',
  });

  // Track key actions via touch / mouse for overlay buttons
  const isPressingGas = useRef(false);
  const isPressingBrake = useRef(false);

  // Sound Synth reference initialization
  useEffect(() => {
    const synth = new AudioSynthesizer();
    audioSynthRef.current = synth;
    return () => {
      synth.stop();
    };
  }, []);

  // Sync mute state
  useEffect(() => {
    if (audioSynthRef.current) {
      if (isMuted) {
        audioSynthRef.current.stop();
        audioSynthRef.current.enabled = false;
      } else {
        audioSynthRef.current.init();
      }
    }
  }, [isMuted]);

  // Restart function
  const restartGame = () => {
    hasStartedRacingRef.current = false;
    statsRef.current = {
      coins: 0,
      distance: 0,
      fuel: 100,
      isGameOver: false,
      reason: 'none',
    };
    setCoins(0);
    setDistance(0);
    setFuel(100);
    setIsGameOver(false);
    setGameOverReason('none');
    
    // Reset vehicle state refs
    vehicleStateRef.current = {
      x: 300,
      y: 150,
      vx: 0,
      vy: 0,
      angle: 0, // Tilt angle
      angularVelocity: 0,
      isGrounded: false,
      rpm: 0,
      airTimeSec: 0,
      backflipStreak: 0,
      lastFlipAngle: 0,
      throttle: 0,
    };

    // Re-generate coins & fuels near player
    generateItems();
    
    if (audioSynthRef.current && !isMuted) {
      audioSynthRef.current.stop();
      audioSynthRef.current.init();
    }
  };

  // Generate terrain items dynamically (saved in refs)
  const itemsRef = useRef<{ x: number; type: 'coin' | 'fuel'; collected: boolean }[]>([]);

  const generateItems = () => {
    const items: { x: number; type: 'coin' | 'fuel'; collected: boolean }[] = [];
    
    // We space out fuel and coins dynamically and statefully to guarantee perfect pacing and no missing elements
    let lastFuelX = 350; // First fuel canister spawned at 1000m interval
    let lastCoinX = 450; // First coin cluster spawned at 550m interval
    
    for (let x = 600; x < 250000; x += 15) {
      // Determine strategic fuel gap depending on how far the player has advanced
      let currentFuelGap = 420; // 420 meters spacing initially (approx 70m step intervals)
      if (x > 10000) currentFuelGap = 650;
      if (x > 25000) currentFuelGap = 920;
      if (x > 50000) currentFuelGap = 1350;
      
      // Check if we should spawn a fuel canister
      if (x - lastFuelX >= currentFuelGap) {
        items.push({ x, type: 'fuel', collected: false });
        lastFuelX = x;
        lastCoinX = x + 100; // separate coins from fuel placement to avoid overlap crowding
      } else if (x - lastCoinX >= 210) {
        // Spawn a beautiful linear 3D coin cluster
        items.push({ x, type: 'coin', collected: false });
        items.push({ x: x + 25, type: 'coin', collected: false });
        items.push({ x: x + 50, type: 'coin', collected: false });
        lastCoinX = x + 80;
      }
    }
    itemsRef.current = items;
  };

  // Vehicle states
  const vehicleStateRef = useRef({
    x: 300,
    y: 150,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    isGrounded: false,
    rpm: 0,
    airTimeSec: 0,
    backflipStreak: 0,
    lastFlipAngle: 0,
    throttle: 0,
  });

  // Load / Setup when stage or vehicle upgrades change
  useEffect(() => {
    restartGame();
  }, [stage, vehicle, upgrades]);

  // Main Canvas & Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    // Handle high density displays
    const resizeCanvas = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      canvas.width = rect?.width || 800;
      canvas.height = 420; // fixed display height
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Dynamic terrain formula based on stage (shifted up by 80px to safely stay in visible viewport)
    const getTerrainHeight = (x: number): number => {
      if (stage.id === 'countryside') {
        return Math.sin(x * 0.002) * 60 + Math.sin(x * 0.007) * 20 + Math.cos(x * 0.0004) * 80 + 230;
      } else if (stage.id === 'desert') {
        return Math.sin(x * 0.0016) * 110 + Math.cos(x * 0.004) * 25 + 240;
      } else if (stage.id === 'arctic') {
        const iceSteps = Math.floor(x / 140) % 2 === 0 ? 15 : -15;
        return Math.sin(x * 0.003) * 50 + Math.sin(x * 0.012) * 20 + Math.cos(x * 0.0006) * 90 + iceSteps + 230;
      } else if (stage.id === 'moon') {
        return Math.abs(Math.sin(x * 0.0012)) * -140 + Math.sin(x * 0.006) * 35 + 180;
      } else if (stage.id.startsWith('extra_stage_')) {
        // Procedural terrain generation based on stage index
        const num = parseInt(stage.id.replace('extra_stage_', ''), 10) || 1;
        const freqMult = 0.001 + (num % 5) * 0.0004;
        const ampMult = 45 + (num % 6) * 12;
        const microFreq = 0.006 + (num % 4) * 0.002;
        const microAmp = 10 + (num % 3) * 6;
        return Math.sin(x * freqMult) * ampMult + Math.cos(x * microFreq) * microAmp + Math.cos(x * 0.0001 * num) * 50 + 220;
      }
      return 220;
    };

    // Keyboard handlers
    const keyStateRef = { gas: false, brake: false };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'd' || key === 'arrowright') {
        setKeyState(prev => ({ ...prev, gas: true }));
        keyStateRef.gas = true;
      }
      if (key === 'a' || key === 'arrowleft') {
        setKeyState(prev => ({ ...prev, brake: true }));
        keyStateRef.brake = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'd' || key === 'arrowright') {
        setKeyState(prev => ({ ...prev, gas: false }));
        keyStateRef.gas = false;
      }
      if (key === 'a' || key === 'arrowleft') {
        setKeyState(prev => ({ ...prev, brake: false }));
        keyStateRef.brake = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Particle particles and spring offsets
    const smokeParticles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = [];
    let driverHeadSpringY = 0;
    let driverHeadSpringVelocity = 0;

    // Setup active loop
    const frame = () => {
      if (canvasRef.current && containerRef.current) {
        const canv = canvasRef.current;
        const cont = containerRef.current;
        if (canv.width !== cont.clientWidth && cont.clientWidth > 0) {
          canv.width = cont.clientWidth;
        }
      }

      if (statsRef.current.isGameOver) {
        if (audioSynthRef.current) {
          audioSynthRef.current.setEngineRPM(0, false, false);
        }
        return;
      }

      const activeGas = keyStateRef.gas || isPressingGas.current;
      const activeBrake = keyStateRef.brake || isPressingBrake.current;

      const vehicleState = vehicleStateRef.current;
      const currentStats = statsRef.current;

      // Extract details from active equipment
      const engineMultiplier = 1 + (upgrades.engine * 0.12);
      const suspensionMultiplier = 1 + (upgrades.suspension * 0.1);
      const tiresMultiplier = 1 + (upgrades.tires * 0.12);
      const fourWdMultiplier = 1 + (upgrades.fourWd * 0.15);

      // Environment Physics values
      const gravity = 0.42 * (stage.id === 'moon' ? 0.18 : 1.0);
      const airDrag = 0.992;
      const rotationSpeed = 0.038;

      // Fuel burn rate: idle is slow, active is fast (Monster Truck gets heavier consumption)
      const fuelConsumptionBase = stage.id === 'moon' ? 0.03 : 0.06;
      const fuelSizeMult = vehicle.id === 'monster' ? 1.4 : vehicle.id === 'motocross' ? 0.8 : 1.0;
      let fuelBurn = fuelConsumptionBase * fuelSizeMult;
      if (activeGas) fuelBurn *= 2.2;
      
      currentStats.fuel = Math.max(0, currentStats.fuel - fuelBurn);
      setFuel(Math.round(currentStats.fuel));

      if (currentStats.fuel <= 0) {
        currentStats.isGameOver = true;
        currentStats.reason = 'fuel';
        setGameOverReason('fuel');
        setIsGameOver(true);
        if (audioSynthRef.current) {
          audioSynthRef.current.playCrashSound();
        }
      }

      // 1. ADVANCED DUAL-WHEEL PHYSICS SYSTEMS
      const cosA = Math.cos(vehicleState.angle);
      const sinA = Math.sin(vehicleState.angle);

      // Spacing of tires in the car local coordinate system
      const wheelH = 25;
      const wheelV = 12;

      // Map back and front tires into rotated layout
      const backXWorld = vehicleState.x - wheelH * cosA - wheelV * sinA;
      const backYWorld = vehicleState.y - wheelH * sinA + wheelV * cosA;

      const frontXWorld = vehicleState.x + wheelH * cosA - wheelV * sinA;
      const frontYWorld = vehicleState.y + wheelH * sinA + wheelV * cosA;

      const backGroundY = getTerrainHeight(backXWorld);
      const frontGroundY = getTerrainHeight(frontXWorld);

      const backDist = backGroundY - backYWorld;
      const frontDist = frontGroundY - frontYWorld;

      // Determine wheel on-ground contacts based on wheel radius
      const wheelRadius = vehicle.id === 'monster' ? 16 : 11.5;
      const backGrounded = backDist <= (wheelRadius + 2.5);
      const frontGrounded = frontDist <= (wheelRadius + 2.5);
      const isCurrentlyGrounded = backGrounded || frontGrounded;
      
      vehicleState.isGrounded = isCurrentlyGrounded;

      let totalForceY = gravity;
      let totalTorque = 0;

      // Back suspension recoil spring based on tyre ground compression
      if (backDist < wheelRadius) {
        const compression = wheelRadius - backDist;
        const springForce = compression * 0.35 * suspensionMultiplier;
        totalForceY -= springForce * 0.65;
        // Pushing rear up rotates clockwise
        totalTorque += springForce * 0.005;
        vehicleState.vy *= 0.82;
      }

      // Front suspension recoil spring based on tyre ground compression
      if (frontDist < wheelRadius) {
        const compression = wheelRadius - frontDist;
        const springForce = compression * 0.35 * suspensionMultiplier;
        totalForceY -= springForce * 0.65;
        // Pushing front up rotates counter-clockwise
        totalTorque -= springForce * 0.005;
        vehicleState.vy *= 0.82;
      }

      // Safety: Prevent chassis from clipping deeply into terrain
      const avgGround = (backGroundY + frontGroundY) / 2;
      const verticalOffset = avgGround - vehicleState.y;
      if (verticalOffset < 24) { 
        const pushCorrection = (24 - verticalOffset) * 0.45;
        vehicleState.y -= pushCorrection;
        vehicleState.vy = Math.min(0, vehicleState.vy - pushCorrection * 0.15);
      }

      const slopeAngle = Math.atan2(frontGroundY - backGroundY, 50);

      const isHelicopter = vehicle.id === 'helicopter';

      // On-ground action or airborne
      if (isCurrentlyGrounded) {
        vehicleState.airTimeSec = 0;

        if (activeGas) {
          const traction = stage.id === 'arctic' ? 0.35 * tiresMultiplier : stage.id === 'desert' ? 0.75 * tiresMultiplier : 1.0 * tiresMultiplier;
          
          // Distinct vehicle base power configurations (Hill Climb Racing characteristics)
          let basePower = 0.45;
          if (vehicle.id === 'motocross') basePower = 0.52;
          else if (vehicle.id === 'monster') basePower = 0.58;
          else if (vehicle.id === 'racecar') basePower = 0.72;
          else if (vehicle.id === 'superjeep') basePower = 0.55;
          else if (vehicle.id === 'helicopter') basePower = 0.58;
          else if (vehicle.id.startsWith('extra_car_')) basePower = 0.50;

          // Smooth progressive throttle: prevents instant wheelies and extreme takeoff
          vehicleState.throttle = Math.min(1.0, (vehicleState.throttle || 0) + 0.025);

          // Speed scale: starts very gentle and controllable, climbs progressively as player extends their run distance
          const runDistance = Math.max(0, (vehicleState.x - 300) / 10);
          const distanceSpeedScale = 0.28 + Math.min(0.82, runDistance / 600); // progressive power scaling
          
          const pushForce = basePower * engineMultiplier * fourWdMultiplier * traction * distanceSpeedScale * vehicleState.throttle;
          
          vehicleState.vx += cosA * pushForce;
          vehicleState.vy += sinA * pushForce;
          
          vehicleState.rpm = vehicleState.rpm * 0.86 + 0.94 * 0.14;

          // WHEELIE torque: lifts nose if accelerating with rear tire grounded
          if (backGrounded && !isHelicopter) {
            totalTorque += 0.0035 * tiresMultiplier * engineMultiplier;
          }
        } else if (activeBrake) {
          const brakeForce = -0.42 * tiresMultiplier;
          vehicleState.vx += cosA * brakeForce;
          vehicleState.vy += sinA * brakeForce;

          vehicleState.rpm = vehicleState.rpm * 0.86 + 0.45 * 0.14;
          vehicleState.throttle = Math.max(0, (vehicleState.throttle || 0) - 0.05);

          // NOSE-DIVE torque on hard breaking
          if (frontGrounded && !isHelicopter) {
            totalTorque -= 0.003 * tiresMultiplier;
          }
        } else {
          // Roll decel
          vehicleState.vx *= 0.985;
          vehicleState.rpm = vehicleState.rpm * 0.94 + 0.15 * 0.06;
          vehicleState.throttle = Math.max(0, (vehicleState.throttle || 0) - 0.05);
        }

        // Rolling rollback due to gravity pull on slopes (balanced so cars don't sink/stall too quickly)
        if (!isHelicopter) {
          vehicleState.vx -= Math.sin(slopeAngle) * 0.082;
        }

        // Assist stabilizing when running smoothly on both wheels
        if (backGrounded && frontGrounded) {
          const diff = slopeAngle - vehicleState.angle;
          totalTorque += diff * 0.22;
        }
      } else {
        // In the Air
        vehicleState.airTimeSec += 0.016;
        vehicleState.vy += gravity;
        vehicleState.vx *= airDrag;

        // Airborne stunts: holding gas tilts back (clockwise), holding brake tilts forward (counter-clockwise)
        if (activeGas) {
          totalTorque += 0.0035 * rotationSpeed * 10;
          vehicleState.rpm = vehicleState.rpm * 0.86 + 0.96 * 0.14;
          vehicleState.throttle = Math.min(1.0, (vehicleState.throttle || 0) + 0.025);
        } else if (activeBrake) {
          totalTorque -= 0.0035 * rotationSpeed * 10;
          vehicleState.rpm = vehicleState.rpm * 0.86 + 0.72 * 0.14;
          vehicleState.throttle = Math.max(0, (vehicleState.throttle || 0) - 0.05);
        } else {
          vehicleState.rpm = vehicleState.rpm * 0.92 + 0.2 * 0.08;
          vehicleState.throttle = Math.max(0, (vehicleState.throttle || 0) - 0.05);
        }
      }

      // Helicopter helicopter! Apply custom flight dynamics anywhere
      if (isHelicopter) {
        if (activeGas) {
          vehicleState.throttle = Math.min(1.0, (vehicleState.throttle || 0) + 0.025);
          const tPower = vehicleState.throttle;

          const runDistance = Math.max(0, (vehicleState.x - 300) / 10);
          const distanceSpeedScale = 0.28 + Math.min(0.82, runDistance / 600);

          // Generate hover lift upwards AND push forward (lift exceeds average gravity 0.42 to fly up beautifully!)
          totalForceY -= 0.62 * engineMultiplier * tPower; 
          vehicleState.vx += Math.cos(vehicleState.angle) * 0.38 * engineMultiplier * tPower * distanceSpeedScale;
          vehicleState.vy += Math.sin(vehicleState.angle) * 0.22 * engineMultiplier * tPower * distanceSpeedScale;
          // Rotor spin sound RPM boost
          vehicleState.rpm = vehicleState.rpm * 0.8 + 0.98 * 0.2;
          // Assist rotation forward
          totalTorque += 0.0035 * rotationSpeed;
        } else if (activeBrake) {
          vehicleState.throttle = Math.max(0, (vehicleState.throttle || 0) - 0.05);
          const tPower = vehicleState.throttle;

          // Descend and move back (reduced lift so gravity lowers the device)
          totalForceY -= 0.22 * engineMultiplier;
          vehicleState.vx -= Math.cos(vehicleState.angle) * 0.26 * engineMultiplier * tPower;
          vehicleState.rpm = vehicleState.rpm * 0.8 + 0.5 * 0.2;
          // Tilt backward
          totalTorque -= 0.0035 * rotationSpeed;
        } else {
          vehicleState.throttle = Math.max(0, (vehicleState.throttle || 0) - 0.05);
          // Stable hover float parachute effect (closely balancing standard gravity with minor sink)
          totalForceY -= (gravity - 0.012); 
          vehicleState.vx *= 0.99;
          vehicleState.vy *= 0.95;
          vehicleState.rpm = vehicleState.rpm * 0.94 + 0.15 * 0.06;
        }
        // Gyroscope dampening keeps helicopter level
        totalTorque += (0 - vehicleState.angle) * 0.045;
      }

      // Rotate vehicle
      vehicleState.angularVelocity += totalTorque;
      vehicleState.angularVelocity *= 0.93; // rotation air damping
      vehicleState.angle += vehicleState.angularVelocity;

      // Flip angle track for trick checking
      if (!isCurrentlyGrounded) {
        const angleDiff = vehicleState.angle - vehicleState.lastFlipAngle;
        if (Math.abs(angleDiff) >= Math.PI * 2) {
          // Successful flip! Play coin noise and give bonus!
          const bonusVal = 1500;
          currentStats.coins += bonusVal;
          setCoins(currentStats.coins);
          if (onCoinsEarned) {
            onCoinsEarned(bonusVal); // sync to garage immediately!
          }
          if (audioSynthRef.current) {
            audioSynthRef.current.playCoinSound();
          }
          vehicleState.lastFlipAngle = vehicleState.angle;
          flipBonusRef.current = { text: `FLIP TRICK BONUS! +${bonusVal}`, duration: 110 };
        }
      } else {
        // align trick reference to slope of terrain once grounded
        vehicleState.lastFlipAngle = vehicleState.angle;
      }

      // Apply vertical speeds
      vehicleState.vy += totalForceY;
      vehicleState.y += vehicleState.vy;
      vehicleState.x += vehicleState.vx;

      // Boundary rules
      if (vehicleState.x < 150) {
        vehicleState.x = 150;
        vehicleState.vx = 0;
      }

      // Synced engine noise RPM pitch
      const isMoving = Math.abs(vehicleState.vx) > 0.15 || Math.abs(vehicleState.vy) > 0.15;
      if (activeGas || activeBrake || isMoving) {
        hasStartedRacingRef.current = true;
      }

      if (audioSynthRef.current && !isMuted) {
        audioSynthRef.current.setEngineRPM(
          vehicleState.rpm,
          hasStartedRacingRef.current,
          isMoving
        );
      }

      // Active Bobblehead face bounce calculations
      const targetBobble = Math.sin(Date.now() / 90) * 1.5 + (vehicleState.vy * 1.4);
      const kFactor = 0.18;
      const dFactor = 0.82;
      driverHeadSpringVelocity += (targetBobble - driverHeadSpringY) * kFactor;
      driverHeadSpringVelocity *= dFactor;
      driverHeadSpringY += driverHeadSpringVelocity;

      // Check crash condition: If car is inverted and driver's head hits ground
      const headOffsetLocalX = -4;
      const headOffsetLocalY = -22 + driverHeadSpringY;
      const headX = vehicleState.x + (headOffsetLocalX * cosA - headOffsetLocalY * sinA);
      const headY = vehicleState.y + (headOffsetLocalX * sinA + headOffsetLocalY * cosA);

      const terrainUnderHead = getTerrainHeight(headX);

      if (headY > terrainUnderHead - 4) {
        if (vehicle.id === 'superjeep' && upgrades.suspension >= 3 && !isCurrentlyGrounded && Math.random() < 0.4) {
          // Saved by roll cage!
          vehicleState.vy = -5.5; // push up with dynamic force
          vehicleState.angle = slopeAngle;
          flipBonusRef.current = { text: 'CAGE BARRIER SAVED YOU!', duration: 110 };
        } else {
          currentStats.isGameOver = true;
          currentStats.reason = 'crash';
          setGameOverReason('crash');
          setIsGameOver(true);
          if (audioSynthRef.current) {
            audioSynthRef.current.playCrashSound();
          }
        }
      }

      // Calculate progress distance
      const distanceTravelled = Math.round(Math.max(0, (vehicleState.x - 300) / 10));
      if (distanceTravelled > currentStats.distance) {
        currentStats.distance = distanceTravelled;
        setDistance(currentStats.distance);
        
        // Update highscore
        if (currentStats.distance > highScore) {
          setHighScore(currentStats.distance);
          localStorage.setItem('hcr_high_score', currentStats.distance.toString());
        }
      }

      // 2. Check collision with Items (Coins and Gas canisters)
      const playerX = vehicleState.x;
      const playerY = vehicleState.y;

      itemsRef.current.forEach(item => {
        if (!item.collected && Math.abs(item.x - playerX) < 42) {
          const itemY = getTerrainHeight(item.x) - 22;
          const dist = Math.hypot(item.x - playerX, itemY - playerY);
          if (dist < 46) {
            item.collected = true;
            if (item.type === 'coin') {
              const coinVal = Math.round(100 * (stage.id === 'moon' ? 2.5 : stage.id === 'arctic' ? 1.5 : stage.id === 'desert' ? 1.2 : 1.0));
              currentStats.coins += coinVal;
              setCoins(currentStats.coins);
              if (onCoinsEarned) {
                onCoinsEarned(coinVal); // Sync coins automatically into the garage!
              }
              if (audioSynthRef.current) {
                audioSynthRef.current.playCoinSound();
              }
            } else if (item.type === 'fuel') {
              currentStats.fuel = 100;
              setFuel(100);
              if (audioSynthRef.current) {
                audioSynthRef.current.playFuelSound();
              }
              // Show fuel gathered text overlay
              flipBonusRef.current = { text: 'FUEL REFILL! +100%', duration: 75 };
            }
          }
        }
      });

      // Camera scrolls following player
      const cameraX = vehicleState.x - 180;

      // Exhaust pipe particle emissions
      if (activeGas && Math.random() < 0.4) {
        const exX = vehicleState.x + (-28 * cosA - (-6) * sinA) - cameraX;
        const exY = vehicleState.y + (-28 * sinA + (-6) * cosA);
        smokeParticles.push({
          x: exX,
          y: exY,
          vx: -vehicleState.vx * 0.45 - (1.0 + Math.random() * 2) * cosA,
          vy: -vehicleState.vy * 0.45 - (0.4 + Math.random() * 1.5) * sinA - (0.4 + Math.random() * 0.8),
          r: 2.5 + Math.random() * 4,
          alpha: 0.8 + Math.random() * 0.2
        });
      }

      // Update smoke particles
      for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.r += 0.14;
        p.alpha -= 0.016;
        if (p.alpha <= 0 || p.r > 20) {
          smokeParticles.splice(i, 1);
        }
      }

      // Clear offscreen canvas and paint
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Rendering logic
      drawGame(ctx, canvas.width, canvas.height, vehicleState.x, vehicleState.y, vehicleState.angle);

      animationId = requestAnimationFrame(frame);
    };

    // Tracking active coin animations / crash indicators
    const flipBonusRef = { current: null as { text: string; duration: number } | null };

    const drawRoundRect = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) => {
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.beginPath();
        ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
        ctx.lineTo(x + w - r, y);
        ctx.arc(x + w - r, y + r, r, Math.PI * 1.5, Math.PI * 2);
        ctx.lineTo(x + w, y + h - r);
        ctx.arc(x + w - r, y + h - r, r, 0, Math.PI * 0.5);
        ctx.lineTo(x + r, y + h);
        ctx.arc(x + r, y + h - r, r, Math.PI * 0.5, Math.PI);
        ctx.closePath();
      }
    };

    const drawGame = (
      c: CanvasRenderingContext2D,
      w: number,
      h: number,
      carX: number,
      carY: number,
      carAngle: number
    ) => {
      const vehicleState = vehicleStateRef.current;
      const currentStats = statsRef.current;
      const activeGas = keyStateRef.gas || isPressingGas.current;
      const cameraX = carX - 180;

      // Stage-specific sky backgrounds
      const bgGrad = c.createLinearGradient(0, 0, 0, h);
      if (stage.id === 'countryside') {
        bgGrad.addColorStop(0, '#075e3a'); // Beautiful emerald green gradient sky
        bgGrad.addColorStop(0.6, '#0f766e');
        bgGrad.addColorStop(1, '#115e59');
      } else if (stage.id === 'desert') {
        bgGrad.addColorStop(0, '#7c2d12'); // Rich deep sunset desert orange/rust
        bgGrad.addColorStop(0.7, '#451a03');
        bgGrad.addColorStop(1, '#292524');
      } else if (stage.id === 'arctic') {
        bgGrad.addColorStop(0, '#0f172a'); // Cold space arctic aurora colors
        bgGrad.addColorStop(0.55, '#083344');
        bgGrad.addColorStop(1, '#115e59');
      } else if (stage.id === 'moon') {
        bgGrad.addColorStop(0, '#030712'); // Perfect vacuum space black
        bgGrad.addColorStop(0.8, '#0b0f19');
        bgGrad.addColorStop(1, '#1e1b4b');
      }
      c.fillStyle = bgGrad;
      c.fillRect(0, 0, w, h);

      // DRAWS BEAUTIFUL PARALLAX STAGE BACKDROPS
      if (stage.id === 'countryside') {
        // Draw floaty white clouds
        c.fillStyle = 'rgba(255, 255, 255, 0.15)';
        for (let idx = 0; idx < 5; idx++) {
          const cx = ((idx * 280) - cameraX * 0.15) % (w + 200) - 100;
          const cy = 40 + (idx * 16) % 40;
          c.beginPath();
          c.arc(cx, cy, 25, 0, Math.PI * 2);
          c.arc(cx + 20, cy - 8, 30, 0, Math.PI * 2);
          c.arc(cx + 45, cy, 22, 0, Math.PI * 2);
          c.fill();
        }
        // Draw forest pine trees in parallax distance
        c.fillStyle = '#134e4a';
        for (let idx = 0; idx < 12; idx++) {
          const tx = ((idx * 130) - cameraX * 0.35) % (w + 100) - 50;
          const ty = 280 + Math.sin(idx * 2.3) * 15;
          c.beginPath();
          c.moveTo(tx, ty);
          c.lineTo(tx - 18, ty + 70);
          c.lineTo(tx + 18, ty + 70);
          c.closePath();
          c.fill();
        }
      } else if (stage.id === 'desert') {
        // Draw big hot sun
        c.fillStyle = 'rgba(251, 146, 60, 0.25)';
        c.beginPath();
        c.arc(w - 180, 80, 60 + Math.sin(Date.now() / 300) * 2, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(254, 215, 170, 0.15)';
        c.beginPath();
        c.arc(w - 180, 80, 100, 0, Math.PI * 2);
        c.fill();

        // Draw orange sandstone plateaus
        c.fillStyle = '#451a03';
        for (let idx = 0; idx < 6; idx++) {
          const mx = ((idx * 310) - cameraX * 0.25) % (w + 300) - 150;
          const mw = 220;
          const mh = 140 + Math.sin(idx) * 30;
          c.fillRect(mx, h - mh, mw, mh);
          // Top edge detail
          c.fillStyle = '#7c2d12';
          c.fillRect(mx - 5, h - mh, mw + 10, 8);
          c.fillStyle = '#451a03';
        }
      } else if (stage.id === 'arctic') {
        // Beautiful polar aurora wave arcs
        c.strokeStyle = 'rgba(34, 211, 238, 0.18)';
        c.lineWidth = 12;
        c.beginPath();
        for (let sx = 0; sx <= w; sx += 30) {
          const sy = 80 + Math.sin(sx * 0.005 + Date.now() * 0.001) * 35;
          if (sx === 0) c.moveTo(sx, sy);
          else c.lineTo(sx, sy);
        }
        c.stroke();

        // Frozen spikes background
        c.fillStyle = '#06b6d4';
        for (let idx = 0; idx < 10; idx++) {
          const px = ((idx * 160) - cameraX * 0.4) % (w + 100) - 50;
          const py = 290 + Math.sin(idx) * 20;
          c.beginPath();
          c.moveTo(px, py);
          c.lineTo(px - 25, py + 90);
          c.lineTo(px + 25, py + 90);
          c.closePath();
          c.fill();
        }
      } else if (stage.id === 'moon') {
        // Beautiful floating stars fields
        c.fillStyle = 'rgba(255, 255, 255, 0.45)';
        for (let idx = 0; idx < 12; idx++) {
          const sX = (idx * 160 - cameraX * 0.3) % w;
          const sY = (idx * 50) % 180 + 20;
          c.beginPath();
          c.arc(sX < 0 ? sX + w : sX, sY, idx % 3 === 0 ? 1 : 1.8, 0, Math.PI * 2);
          c.fill();
        }
        // Floating blue Earth globe in lunar sky!
        c.save();
        c.translate(w - 140, 80);
        c.fillStyle = 'rgba(59, 130, 246, 0.35)';
        c.beginPath();
        c.arc(0, 0, 36, 0, Math.PI * 2);
        c.fill();
        
        // Green continent swirls on Earth
        c.fillStyle = 'rgba(34, 197, 94, 0.2)';
        c.beginPath();
        c.arc(-10, -5, 12, 0, Math.PI * 2);
        c.arc(10, 8, 14, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }

      // Draw Coins & Fuels
      itemsRef.current.forEach(item => {
        if (item.x > cameraX - 100 && item.x < cameraX + w + 100 && !item.collected) {
          const itemY = getTerrainHeight(item.x) - 22;
          const screenX = item.x - cameraX;

          if (item.type === 'coin') {
            const coinTick = (Date.now() / 150) % (Math.PI * 2);
            c.save();
            c.translate(screenX, itemY);
            
            // Floating bounce effect
            const bounceY = Math.sin((item.x * 0.05) + Date.now() / 200) * 3;
            c.translate(0, bounceY);
            
            const cost = Math.cos(coinTick);
            const thickness = 4; // 3D Extrusion thickness
            
            // Draw dark extruded 3D gold edge
            c.fillStyle = '#92400e';
            c.strokeStyle = '#451a03';
            c.lineWidth = 1.2;
            for (let t = 0; t <= thickness; t++) {
              c.beginPath();
              c.ellipse(t, 0, 10.5 * Math.abs(cost), 10.5, 0, 0, Math.PI * 2);
              c.fill();
              if (t === thickness) c.stroke();
            }
            
            // Bright gold gradient face of the rotating coin
            const coinGrad = c.createRadialGradient(-3, -3, 1, 0, 0, 10);
            coinGrad.addColorStop(0, '#fef08a');
            coinGrad.addColorStop(0.7, '#fbbf24');
            coinGrad.addColorStop(1, '#b45309');
            
            c.fillStyle = coinGrad;
            c.strokeStyle = '#78350f';
            c.lineWidth = 1.8;
            c.beginPath();
            c.ellipse(0, 0, 10.5 * Math.abs(cost), 10.5, 0, 0, Math.PI * 2);
            c.fill();
            c.stroke();

            // inner detail embossed ring
            c.strokeStyle = 'rgba(251, 191, 36, 0.8)';
            c.lineWidth = 1;
            c.beginPath();
            c.ellipse(0, 0, 7.2 * Math.abs(cost), 7.2, 0, 0, Math.PI * 2);
            c.stroke();

            // Centered dollar indicator ($)
            if (Math.abs(cost) > 0.3) {
              c.save();
              c.scale(cost, 1);
              c.fillStyle = '#78350f';
              c.font = 'bold 9px monospace';
              c.textAlign = 'center';
              c.textBaseline = 'middle';
              c.fillText('$', 0, 0.6);
              c.restore();
            }
            c.restore();
          } else if (item.type === 'fuel') {
            // Retro Crimson Fuel Canister drawn in full isometric 3D-block dimensions!
            c.save();
            c.translate(screenX, itemY);
            
            // Floating hover wobble
            const bounceY = Math.sin((item.x * 0.05) + Date.now() / 250) * 4;
            c.translate(0, bounceY);
            
            const cd = 5; // isometric depth size of the 3D canister
            
            // Draw isometric side face (3D darkness depth)
            c.fillStyle = '#7f1d1d';
            c.strokeStyle = '#450a0a';
            c.lineWidth = 1.5;
            c.beginPath();
            c.moveTo(9, -11);
            c.lineTo(9 + cd, -11 - cd);
            c.lineTo(9 + cd, 11 - cd);
            c.lineTo(9, 11);
            c.closePath();
            c.fill();
            c.stroke();
            
            // Draw isometric top face (highlighted 3D deck)
            c.fillStyle = '#f87171';
            c.beginPath();
            c.moveTo(-9, -11);
            c.lineTo(-9 + cd, -11 - cd);
            c.lineTo(9 + cd, -11 - cd);
            c.lineTo(9, -11);
            c.closePath();
            c.fill();
            c.stroke();

            // Front primary face
            const fuelGrad = c.createLinearGradient(-9, -10, 9, 10);
            fuelGrad.addColorStop(0, '#ef4444');
            fuelGrad.addColorStop(1, '#991b1b');
            
            c.fillStyle = fuelGrad;
            c.strokeStyle = '#7f1d1d';
            c.lineWidth = 1.8;
            c.beginPath();
            drawRoundRect(c, -9, -11, 18, 22, 3);
            c.fill();
            c.stroke();
            
            // 3D silver nozzle
            c.fillStyle = '#cbd5e1';
            c.fillRect(-5, -15, 3, 4);
            c.strokeRect(-5, -15, 3, 4);
            
            c.fillStyle = '#64748b';
            c.beginPath();
            c.moveTo(-2, -15);
            c.lineTo(-2 + cd, -15 - cd);
            c.lineTo(-5 + cd, -15 - cd);
            c.closePath();
            c.fill();

            // yellow warning band
            c.fillStyle = '#fbbf24';
            c.fillRect(-9, -1, 18, 5);

            // text 'FUEL' labels
            c.fillStyle = '#ffffff';
            c.font = 'bold 8px sans-serif';
            c.textAlign = 'center';
            c.fillText('FUEL', 0, 2.5);
            c.restore();
          }
        }
      });

      // Draw exhaust smoke puffs on fly
      smokeParticles.forEach(p => {
        c.save();
        c.beginPath();
        c.fillStyle = `rgba(226, 232, 240, ${p.alpha})`;
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });

      // Assemble Terrain coordinate arrays
      c.beginPath();
      const dirtGrad = c.createLinearGradient(0, 200, 0, h);
      if (stage.id === 'countryside') {
        dirtGrad.addColorStop(0, '#166534');
        dirtGrad.addColorStop(0.2, '#14532d');
        dirtGrad.addColorStop(1, '#062f17');
      } else if (stage.id === 'desert') {
        dirtGrad.addColorStop(0, '#7c2d12');
        dirtGrad.addColorStop(0.3, '#431407');
        dirtGrad.addColorStop(1, '#1c0a00');
      } else if (stage.id === 'arctic') {
        dirtGrad.addColorStop(0, '#1e3a8a');
        dirtGrad.addColorStop(0.4, '#172554');
        dirtGrad.addColorStop(1, '#020617');
      } else {
        dirtGrad.addColorStop(0, '#1e293b');
        dirtGrad.addColorStop(0.4, '#0f172a');
        dirtGrad.addColorStop(1, '#020617');
      }
      c.fillStyle = dirtGrad;
      c.moveTo(0, h);

      for (let sx = 0; sx <= w + 40; sx += 12) {
        const theoreticalX = cameraX + sx;
        const theoreticalY = getTerrainHeight(theoreticalX);
        c.lineTo(sx, theoreticalY);
      }
      c.lineTo(w, h);
      c.fill();

      // Paint Terrain Grass top ridge
      c.beginPath();
      c.lineWidth = 5;
      c.strokeStyle = stage.id === 'countryside' ? '#22c55e' : stage.id === 'desert' ? '#f97316' : stage.id === 'arctic' ? '#e2e8f0' : '#64748b';

      for (let sx = 0; sx <= w + 40; sx += 12) {
        const theoreticalX = cameraX + sx;
        const theoreticalY = getTerrainHeight(theoreticalX);
        if (sx === 0) c.moveTo(sx, theoreticalY);
        else c.lineTo(sx, theoreticalY);
      }
      c.stroke();

      // Render the player car
      const screenCarX = carX - cameraX;
      c.save();
      c.translate(screenCarX, carY);
      c.rotate(carAngle);

      const primaryColor = vehicle.accentColor;
      const maxEngineActive = upgrades.engine > 5;
      
      // Draw Suspension spring lines to wheels
      c.strokeStyle = '#64748b';
      c.lineWidth = 3;
      // Front suspension spring coil
      c.beginPath();
      c.moveTo(25, 0);
      c.lineTo(25, 12);
      c.stroke();
      // Rear suspension spring coil
      c.beginPath();
      c.moveTo(-25, 0);
      c.lineTo(-25, 12);
      c.stroke();

      // Draw Wheels
      const drawWheel = (wx: number, wy: number) => {
        c.save();
        c.translate(wx, wy);
        
        // Spin wheels based on distance travelled
        const spin = (carX / 10) % (Math.PI * 2);
        c.rotate(spin);

        const wheelRadius = vehicle.id === 'monster' ? 16 : 11.5;
        
        // Outer tyre rim
        c.fillStyle = '#020617';
        c.strokeStyle = '#334155';
        c.lineWidth = 3.0;
        c.beginPath();
        c.arc(0, 0, wheelRadius, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // Tire tread ticks
        c.strokeStyle = '#475569';
        c.lineWidth = 2.0;
        for (let tickIdx = 0; tickIdx < 8; tickIdx++) {
          const tA = (tickIdx * Math.PI) / 4;
          c.beginPath();
          c.moveTo(Math.cos(tA) * (wheelRadius - 3.5), Math.sin(tA) * (wheelRadius - 3.5));
          c.lineTo(Math.cos(tA) * wheelRadius, Math.sin(tA) * wheelRadius);
          c.stroke();
        }

        // Inner hubs cap
        c.fillStyle = '#e2e8f0';
        c.strokeStyle = '#475569';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(0, 0, wheelRadius * 0.45, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // High contrast tire spoke center
        c.fillStyle = '#0f172a';
        c.beginPath();
        c.arc(0, 0, 2, 0, Math.PI * 2);
        c.fill();

        c.restore();
      };
      
      // Wheels drawing
      // Helicopters don't have rolling ground wheels - they stand on beautiful landing skids drawn dynamically in chassis!
      const isHelicopter = vehicle.id === 'helicopter';
      if (!isHelicopter) {
        drawWheel(25, 12);
        drawWheel(-25, 12);
      }

      // Draw Main Car Chassis
      if (isHelicopter) {
        // Draw elegant Helicopter Fuselage, rotors, and rotating blades
        c.fillStyle = primaryColor;
        c.beginPath();
        c.arc(0, -9, 14, 0, Math.PI * 2); // rounded cabin bubble
        c.fill();
        
        // Front glass bubble windshield visor
        c.fillStyle = 'rgba(56, 189, 248, 0.72)';
        c.beginPath();
        c.arc(6, -11, 8, -Math.PI / 3, Math.PI / 3);
        c.fill();

        // Tail Boom
        c.strokeStyle = primaryColor;
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(-10, -9);
        c.lineTo(-34, -13); // Tail boom extends backward
        c.stroke();

        // Tail vertical fin
        c.fillStyle = '#1e293b';
        c.beginPath();
        c.moveTo(-34, -13);
        c.lineTo(-38, -23);
        c.lineTo(-32, -13);
        c.closePath();
        c.fill();

        // Rear rotor blade (spinning)
        const rearRotorAngle = (Date.now() * 0.04) % (Math.PI * 2);
        c.save();
        c.translate(-36, -18);
        c.rotate(rearRotorAngle);
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, -7);
        c.lineTo(0, 7);
        c.stroke();
        c.restore();

        // Landing skids underneath
        c.strokeStyle = '#64748b';
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(-14, 2);
        c.lineTo(-10, 8);
        c.lineTo(10, 8);
        c.lineTo(14, 2);
        c.stroke();
        c.beginPath();
        c.moveTo(-16, 8);
        c.lineTo(16, 8); // skid runner
        c.stroke();

        // Main rotor mast & spinning rotor blades
        c.fillStyle = '#475569';
        c.fillRect(-2.5, -23, 5, 10); // mast

        c.save();
        c.translate(0, -23);
        // Spin blade using horizontal projection (width oscillates as a cosine wave representing 3D spinning!)
        const bladeSpanX = Math.cos(Date.now() * 0.07) * 35;
        c.strokeStyle = '#e2e8f0';
        c.lineWidth = 3.2;
        c.beginPath();
        c.moveTo(-bladeSpanX, 0);
        c.lineTo(bladeSpanX, 0);
        c.stroke();
        
        // rotor center hub
        c.fillStyle = '#0f172a';
        c.beginPath();
        c.arc(0, 0, 3, 0, Math.PI * 2);
        c.fill();
        c.restore();

      } else if (vehicle.id === 'motocross') {
        // Redraw motocross bike chassis
        c.strokeStyle = primaryColor;
        c.lineWidth = 4.5;
        c.beginPath();
        c.moveTo(-25, 0);
        c.lineTo(0, -7);
        c.lineTo(25, 0);
        c.stroke();

        // Engine core block structure
        c.fillStyle = '#475569';
        c.fillRect(-6, -4, 12, 7);

        // Handlebars
        c.strokeStyle = '#ffffff';
        c.beginPath();
        c.moveTo(14, -7);
        c.lineTo(18, -19);
        c.lineTo(25, -19);
        c.stroke();

        c.fillStyle = '#d97706';
        c.fillRect(21, -20.5, 4, 3); // handlebar handle grip yellow

        // Seat block
        c.fillStyle = '#0f172a';
        c.fillRect(-14, -10, 15, 4);
      } else if (vehicle.id === 'racecar') {
        // Sleek racing chassis paint
        c.fillStyle = primaryColor;
        c.beginPath();
        c.moveTo(-32, 2);
        c.lineTo(-31, -7);
        c.lineTo(-13, -8);
        c.lineTo(11, -3);
        c.lineTo(34, 1);
        c.lineTo(34, 5);
        c.lineTo(-32, 5);
        c.fill();

        // cockpit hood
        c.fillStyle = 'rgba(56, 189, 248, 0.7)';
        c.beginPath();
        c.moveTo(-8, -7);
        c.lineTo(6, -3);
        c.lineTo(-2, -3);
        c.closePath();
        c.fill();

        // Spoiler stabilizer
        c.fillStyle = '#020617';
        c.fillRect(-34, -15, 11, 4);
        c.strokeStyle = '#1e293b';
        c.lineWidth = 2.0;
        c.beginPath();
        c.moveTo(-30, -7);
        c.lineTo(-30, -11);
        c.stroke();
      } else {
        // Jeep & Monster chassis styling
        c.fillStyle = primaryColor;
        c.beginPath();
        drawRoundRect(c, -30, -9, 60, 11, 2); // lower chassis base
        c.fill();
        c.beginPath();
        drawRoundRect(c, -15, -17, 26, 9, 2); // front hood
        c.fill();

        // Yellow high beam details
        c.fillStyle = '#fef08a';
        c.beginPath();
        c.arc(28, -6, 3.5, 0, Math.PI * 2);
        c.fill();

        // Cabin windshield pillars
        c.strokeStyle = '#334155';
        c.lineWidth = 3.0;
        c.beginPath();
        c.moveTo(10, -9);
        c.lineTo(0, -23);
        c.lineTo(-24, -23);
        c.lineTo(-28, -9);
        c.stroke();

        // Jeep mudguards
        c.fillStyle = '#1e293b';
        c.fillRect(-32, -3, 13, 4.5);
        c.fillRect(19, -3, 13, 4.5);

        // Super Jeep roll bar
        if (vehicle.id === 'superjeep') {
          c.strokeStyle = '#f43f5e';
          c.lineWidth = 2;
          c.strokeRect(-21, -21, 22, 12);
        }

        // Active nitrous flame visual
        if (maxEngineActive && activeGas) {
          const flameSize = 12 + Math.random() * 15;
          c.fillStyle = '#f97316';
          c.beginPath();
          c.moveTo(-32, -5);
          c.lineTo(-32 - flameSize, -7.5);
          c.lineTo(-32, -10);
          c.closePath();
          c.fill();
        }
      }

      // Draw driver helmet & bobblehead Bill
      c.save();
      c.translate(-4, -19);
      // Incorporate spring physics rotation as well
      const activeHeadBounce = driverHeadSpringY * 0.08;
      c.rotate(activeHeadBounce);

      // Driver shirt body
      c.fillStyle = '#0369a1'; // Blue overalls shirt
      c.fillRect(-4, 0, 8, 11);

      // Neck joint
      c.fillStyle = '#fed7aa';
      c.fillRect(-1.5, -4, 3, 4);

      // Dynamic struggling / expression detection for Bill's face
      const isStruggling = (currentStats.fuel < 25) || (vehicleState.airTimeSec > 0.7) || (Math.abs(vehicleState.angle) > 0.65);

      // Outer Helmet shell base
      c.fillStyle = '#ea580c'; // Helmet color orange
      c.beginPath();
      c.arc(0, -7.5, 7.8, 0, Math.PI * 2);
      c.fill();

      // Draw Bill's face skin tone cutout
      c.fillStyle = '#ffedd5'; // Peach tone face skin
      c.beginPath();
      c.arc(2.0, -7.0, 5.2, 0, Math.PI * 2);
      c.fill();

      // Draw Bill's cartoon eyes based on struggling state
      if (isStruggling) {
        // Shocked wide panic eyes!
        c.fillStyle = '#ffffff';
        c.strokeStyle = '#000000';
        c.lineWidth = 0.8;
        c.beginPath();
        c.arc(1.4, -9.0, 2.0, 0, Math.PI * 2);
        c.arc(4.0, -9.0, 2.0, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        c.fillStyle = '#000000';
        c.beginPath();
        c.arc(1.4, -9.0, 0.9, 0, Math.PI * 2);
        c.arc(4.0, -9.0, 0.9, 0, Math.PI * 2);
        c.fill();
      } else {
        // Happy little cartoon eyes
        c.fillStyle = '#000000';
        c.beginPath();
        c.arc(2.2, -9.0, 1.2, 0, Math.PI * 2);
        c.arc(4.6, -9.0, 1.2, 0, Math.PI * 2);
        c.fill();
      }

      // Draw Bill's mouth based on struggling state
      if (isStruggling) {
        // Screaming big open mouth!
        c.fillStyle = '#7f1d1d'; // Crimson throat back
        c.beginPath();
        c.arc(2.8, -5.0, 2.4, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#ffffff';
        c.lineWidth = 0.8;
        c.stroke();
      } else {
        // Big happy curve smile
        c.strokeStyle = '#b45309';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(3.0, -6.5, 2.5, 0.1, Math.PI - 0.1);
        c.stroke();
      }

      // Shiny helmet outline / glossy visor highlight line overlay
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.3;
      c.beginPath();
      c.arc(0, -7.5, 7.8, -Math.PI / 2, Math.PI / 4);
      c.stroke();

      c.restore(); // bobblehead Bill

      c.restore(); // main car rotation

      // DRAWS RETRO GLASS HUD INSTRUMENT DASHBOARD GAUGES
      c.save();
      c.translate(20, h - 90);
      
      // Backdrop panel glassmorphism container
      c.fillStyle = 'rgba(15, 23, 42, 0.72)';
      c.strokeStyle = 'rgba(71, 85, 105, 0.5)';
      c.lineWidth = 1;
      c.beginPath();
      drawRoundRect(c, 0, 0, 150, 75, 14);
      c.fill();
      c.stroke();

      // 1. TACHOMETER (RPM DIAL) left side
      const rpmX = 40;
      const rpmY = 40;
      const dialR = 25;
      c.strokeStyle = 'rgba(71, 85, 105, 0.7)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(rpmX, rpmY, dialR, -Math.PI, 0); // half circle dial
      c.stroke();

      // Gauge markings tick bounds
      c.strokeStyle = '#cbd5e1';
      c.lineWidth = 1;
      for (let mark = 0; mark <= 8; mark++) {
        const theta = -Math.PI + (mark / 8) * Math.PI;
        c.beginPath();
        c.moveTo(rpmX + Math.cos(theta) * (dialR - 3), rpmY + Math.sin(theta) * (dialR - 3));
        c.lineTo(rpmX + Math.cos(theta) * dialR, rpmY + Math.sin(theta) * dialR);
        c.stroke();
      }
      
      // Active pointer needle
      const rpmAngle = -Math.PI + (Math.min(1.0, vehicleState.rpm) * Math.PI);
      c.strokeStyle = '#ef4444'; // glowing red needle
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(rpmX, rpmY);
      c.lineTo(rpmX + Math.cos(rpmAngle) * (dialR - 2), rpmY + Math.sin(rpmAngle) * (dialR - 2));
      c.stroke();

      c.fillStyle = '#cbd5e1';
      c.font = 'bold 7px monospace';
      c.textAlign = 'center';
      c.fillText('RPM x1000', rpmX, rpmY + 12);

      // 2. SPEEDOMETER (SPEED DIAL) right side
      const spX = 110;
      const spY = 40;
      c.strokeStyle = 'rgba(71, 85, 105, 0.7)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(spX, spY, dialR, -Math.PI, 0);
      c.stroke();

      // Speed markings
      c.strokeStyle = '#cbd5e1';
      c.lineWidth = 1;
      for (let mark = 0; mark <= 6; mark++) {
        const theta = -Math.PI + (mark / 6) * Math.PI;
        c.beginPath();
        c.moveTo(spX + Math.cos(theta) * (dialR - 3), spY + Math.sin(theta) * (dialR - 3));
        c.lineTo(spX + Math.cos(theta) * dialR, spY + Math.sin(theta) * dialR);
        c.stroke();
      }

      const kmH = Math.round(Math.abs(vehicleState.vx) * 6.5);
      const speedPct = Math.min(1.0, Math.abs(vehicleState.vx) / 16.0);
      const speedAngle = -Math.PI + speedPct * Math.PI;
      
      c.strokeStyle = '#f59e0b'; // amber needle
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(spX, spY);
      c.lineTo(spX + Math.cos(speedAngle) * (dialR - 2), spY + Math.sin(speedAngle) * (dialR - 2));
      c.stroke();

      c.fillStyle = '#cbd5e1';
      c.font = 'bold 7px monospace';
      c.textAlign = 'center';
      c.fillText(`${kmH} km/h`, spX, spY + 12);

      c.restore();

      // Paint visual indicators like "FLIP BONUS!"
      if (flipBonusRef.current) {
        const bonus = flipBonusRef.current;
        c.save();
        c.fillStyle = '#fbbf24';
        c.font = 'bold 14px sans-serif';
        c.shadowColor = '#d97706';
        c.shadowBlur = 6;
        c.textAlign = 'center';
        c.fillText(bonus.text, w / 2, 120);
        c.restore();

        bonus.duration--;
        if (bonus.duration <= 0) {
          flipBonusRef.current = null;
        }
      }
    };

    // Begin Loop
    animationId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [stage, vehicle, upgrades, isMuted, highScore]);

  return (
    <div className="bg-[#0b0f17] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* HUD Header */}
      <div className="bg-slate-900/90 border-b border-slate-800 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-white relative z-10 backdrop-blur-md">
        <div id="distance-tracker" className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <div>
            <div className="text-[10px] text-slate-400 font-medium">DISTANCE</div>
            <div className="text-lg font-black tracking-wide text-amber-50">{distance} m</div>
          </div>
        </div>

        <div id="coin-counter" className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center font-bold text-slate-950 text-xs shadow-md shadow-amber-500/20">$</div>
          <div>
            <div className="text-[10px] text-slate-400 font-medium">COINS</div>
            <div className="text-lg font-black tracking-wide text-yellow-400 font-mono">+{coins}</div>
          </div>
        </div>

        {/* FUEL BAR */}
        <div id="fuel-gauge" className="col-span-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" /> FUEL
            </span>
            <span className={`text-[11px] font-bold ${fuel < 25 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
              {fuel}%
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-100 ${
                fuel < 25 ? 'bg-red-500 animate-pulse' : fuel < 50 ? 'bg-orange-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${fuel}%` }}
            />
          </div>
        </div>

        {/* MUTE & SCORE INFO */}
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-[10px] text-slate-400 font-medium">BEST DISTANCE</div>
            <div className="text-xs font-bold text-slate-300">{highScore} m</div>
          </div>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-xl border transition-all ${
              isMuted
                ? 'bg-slate-950/40 border-slate-800 text-slate-500 hover:text-slate-300'
                : 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20'
            }`}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Simulator canvas body container */}
      <div ref={containerRef} className="relative h-[280px] sm:h-[420px] bg-slate-950 select-none">
        <canvas id="game-board-canvas" ref={canvasRef} className="block w-full h-[280px] sm:h-[420px]" />

        {/* GAME OVER CARD OVERLAY */}
        {isGameOver && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="bg-slate-900 border-2 border-red-500/40 rounded-3xl p-6 sm:p-8 max-w-sm shadow-2xl animate-in scale-in duration-200">
              <h3 className="text-2xl sm:text-3xl font-black text-red-500 uppercase tracking-widest mb-1">
                {gameOverReason === 'crash' ? 'Driver Down!' : 'Out of Gas!'}
              </h3>
              <p className="text-xs text-slate-400 font-medium mb-4">
                {gameOverReason === 'crash'
                  ? 'Flipped over! Bill cracked his helmet. Remember to manage your flight balance!'
                  : 'Fuel dried up! Keep your eyes on fuel placement markers in advance.'}
              </p>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 grid grid-cols-2 gap-3 text-left mb-6 font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">DISTANCE</div>
                  <div className="text-base font-bold text-slate-200">{distance}m</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 font-medium">COINS EARNED</div>
                  <div className="text-base font-bold text-yellow-400">+{coins}</div>
                </div>
              </div>

              <button
                onClick={restartGame}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 hover:scale-[1.02] active:scale-[0.98] font-black text-sm py-3 px-6 rounded-2xl transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> RESTART RACING
              </button>
            </div>
          </div>
        )}

        {/* CONTROLLER TOUCH HUD for mobile view/mouse clicks */}
        {!isGameOver && (
          <div className="absolute bottom-6 left-6 right-6 flex justify-between gap-24 pointer-events-none select-none">
            {/* BRAKE BUTTON */}
            <button
              onMouseDown={() => {
                isPressingBrake.current = true;
                setKeyState(p => ({ ...p, brake: true }));
              }}
              onMouseUp={() => {
                isPressingBrake.current = false;
                setKeyState(p => ({ ...p, brake: false }));
              }}
              onMouseLeave={() => {
                isPressingBrake.current = false;
                setKeyState(p => ({ ...p, brake: false }));
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                isPressingBrake.current = true;
                setKeyState(p => ({ ...p, brake: true }));
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                isPressingBrake.current = false;
                setKeyState(p => ({ ...p, brake: false }));
              }}
              className={`pointer-events-auto w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 flex flex-col items-center justify-center font-black select-none text-[10px] sm:text-xs transition-all shadow-xl active:scale-95 ${
                keyState.brake
                  ? 'bg-red-500 border-red-400 text-white shadow-red-500/30'
                  : 'bg-slate-900/80 border-slate-700 hover:border-slate-500 text-slate-300'
              }`}
            >
              <div className="text-lg sm:text-xl font-black">BRAKE</div>
              <div className="text-[8px] sm:text-[9px] text-slate-400 font-medium font-mono">TILT LEFT (A)</div>
            </button>

            {/* GAS BUTTON */}
            <button
              onMouseDown={() => {
                isPressingGas.current = true;
                setKeyState(p => ({ ...p, gas: true }));
              }}
              onMouseUp={() => {
                isPressingGas.current = false;
                setKeyState(p => ({ ...p, gas: false }));
              }}
              onMouseLeave={() => {
                isPressingGas.current = false;
                setKeyState(p => ({ ...p, gas: false }));
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                isPressingGas.current = true;
                setKeyState(p => ({ ...p, gas: true }));
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                isPressingGas.current = false;
                setKeyState(p => ({ ...p, gas: false }));
              }}
              className={`pointer-events-auto w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 flex flex-col items-center justify-center font-black select-none text-[10px] sm:text-xs transition-all shadow-xl active:scale-95 ${
                keyState.gas
                  ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-amber-500/30'
                  : 'bg-slate-900/80 border-slate-700 hover:border-slate-500 text-slate-300'
              }`}
            >
              <div className="text-lg sm:text-xl font-black">GAS</div>
              <div className="text-[8px] sm:text-[9px] text-slate-400 font-medium font-mono">TILT RIGHT (D)</div>
            </button>
          </div>
        )}
      </div>

      {/* Simulator Control Panel bottom tray */}
      <div className="bg-slate-900/60 p-4 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-slate-950 font-mono text-slate-300 font-bold border border-slate-800">PC CONTROLS</span>
          <span>D / Right Arrow = Accelerate, A / Left Arrow = Brake</span>
        </div>
        <div>
          <span>Active Setup: </span>
          <span className="font-bold text-slate-200">{vehicle.name}</span>
          <span className="mx-1 text-slate-600">|</span>
          <span>Stage: </span>
          <span className="font-bold text-slate-200">{stage.name}</span>
        </div>
      </div>
    </div>
  );
};
