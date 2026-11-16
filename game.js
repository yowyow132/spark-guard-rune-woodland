(() => {
  'use strict';

  // =========================================================================
  // Constants & Configuration
  // =========================================================================
  const VIEW_W = 1280;
  const VIEW_H = 720;
  const WORLD_W = 1600;
  const WORLD_H = 1000;

  // Performance & Endless-mode safety caps
  const CAPS = {
    maxActiveEnemies: 48,
    maxWaveQueue: 140,
    maxPlayerBullets: 160,
    maxEnemyBullets: 140,
    maxPickups: 90,
    maxParticles: 260,
    maxFloatingTexts: 45,
  };

  // Walkable clearing aligned to bg_glade.png stone/grass floor (with rounded corners)
  const GLADE = {
    minX: 255,
    maxX: 1345,
    minY: 385,
    maxY: 805,
    cornerX: 175,
    cornerY: 115,
  };

  // Central Runic Altar aligned 1:1 to bg_glade.png stone rune circle
  const ALTAR = {
    x: 796,
    y: 536,
    rx: 168,
    ry: 112,
    activeDuration: 12.0,
    chargeDuration: 2.5,
    graceDuration: 1.2,
    cooldownDuration: 20.0,
    firstDelay: 14.0,
  };

  const PALETTE = {
    bg: '#0B161E',
    ink: '#071015',
    surface: '#13262A',
    cyan: '#38E8C6',
    gold: '#FFB347',
    text: '#F4EFE6',
    blight: '#A855F7',
    heal: '#34D399',
    crimson: '#EF4444',
  };

  const STORAGE_KEYS = {
    highScore: 'ember_warden_highscore',
    bestWave: 'ember_warden_bestwave',
  };

  const ASSET_MANIFEST = {
    bg_glade: 'assets/bg_glade.png',
    title_crest: 'assets/title_crest.png',
    player_warden: 'assets/player_warden.png',
    enemy_imp: 'assets/enemy_imp.png',
    enemy_wisp: 'assets/enemy_wisp.png',
    enemy_golem: 'assets/enemy_golem.png',
    boss_thornwood: 'assets/boss_thornwood.png',
    proj_ember: 'assets/proj_ember.png',
    proj_blight: 'assets/proj_blight.png',
    pickup_mana: 'assets/pickup_mana.png',
    pickup_tome: 'assets/pickup_tome.png',
    pickup_sigil: 'assets/pickup_sigil.png',
    pickup_shield: 'assets/pickup_shield.png',
    pickup_herb: 'assets/pickup_herb.png',
  };

  const BLESSINGS = [
    {
      id: 'rapid_fire',
      name: '星火疾射',
      icon: 'assets/proj_ember.png',
      desc: '主武器施法速度提升 +18%，釋放更密集的星火連彈。',
      apply: (p) => {
        p.fireRateMult = Math.min(3.2, p.fireRateMult * 1.18);
      },
    },
    {
      id: 'ember_power',
      name: '聚能增幅',
      icon: 'assets/pickup_tome.png',
      desc: '所有星火秘法彈與星火連爆傷害提升 +22%。',
      apply: (p) => {
        p.damageMult *= 1.22;
      },
    },
    {
      id: 'split_rune',
      name: '擴散符文',
      icon: 'assets/pickup_sigil.png',
      desc: '主武器額外增加 +1 發星火彈（微幅扇形散射，可與三重符印疊加）。',
      apply: (p) => {
        p.extraProjectiles = Math.min(5, p.extraProjectiles + 1);
      },
    },
    {
      id: 'pierce_spark',
      name: '貫穿星火',
      icon: 'assets/proj_ember.png',
      desc: '所有星火投射物可額外穿透 +1 名魔物。',
      apply: (p) => {
        p.pierceBonus = Math.min(5, p.pierceBonus + 1);
      },
    },
    {
      id: 'swift_blink',
      name: '疾風瞬步',
      icon: 'assets/pickup_shield.png',
      desc: '秘法瞬步冷卻縮減 -20%，無敵閃避時間延長 +0.05 秒。',
      apply: (p) => {
        p.blinkCdMult = Math.max(0.35, p.blinkCdMult * 0.8);
        p.blinkIframeBonus = Math.min(0.3, p.blinkIframeBonus + 0.05);
      },
    },
    {
      id: 'arcane_magnet',
      name: '秘法磁石',
      icon: 'assets/pickup_mana.png',
      desc: '道具磁吸半徑提升 +45%，魔力結晶經驗值獲取提升 +15%。',
      apply: (p) => {
        p.magnetRadius = Math.min(420, p.magnetRadius * 1.45);
        p.xpMult *= 1.15;
      },
    },
    {
      id: 'glade_vitality',
      name: '林地淬鍊',
      icon: 'assets/pickup_herb.png',
      desc: '最大生命值提升 +25，並立即恢復 25 點生命精魄。',
      apply: (p) => {
        p.maxHp += 25;
        p.hp = Math.min(p.maxHp, p.hp + 25);
      },
    },
    {
      id: 'burst_mastery',
      name: '連爆充能',
      icon: 'assets/title_crest.png',
      desc: '星火連爆冷卻縮減 -25%，連爆散射彈數額外 +2 發。',
      apply: (p) => {
        p.burstCdMult *= 0.75;
        p.burstExtraBolts += 2;
      },
    },
  ];

  // =========================================================================
  // DOM References
  // =========================================================================
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const ui = {
    hud: document.getElementById('hud'),
    hpBar: document.getElementById('hp-bar'),
    hpText: document.getElementById('hp-text'),
    blinkBar: document.getElementById('blink-bar'),
    blinkStatus: document.getElementById('blink-status'),
    burstCount: document.getElementById('burst-count'),
    burstPip0: document.getElementById('burst-pip-0'),
    burstPip1: document.getElementById('burst-pip-1'),
    shieldPip0: document.getElementById('shield-pip-0'),
    shieldPip1: document.getElementById('shield-pip-1'),
    buffBadges: document.getElementById('buff-badges'),
    hudBlessings: document.getElementById('hud-blessings'),
    wavePill: document.getElementById('wave-pill'),
    waveNum: document.getElementById('wave-num'),
    enemiesLeft: document.getElementById('enemies-left'),
    bossHud: document.getElementById('boss-hud'),
    bossPhaseTag: document.getElementById('boss-phase-tag'),
    bossHpText: document.getElementById('boss-hp-text'),
    bossHpBar: document.getElementById('boss-hp-bar'),
    scoreNum: document.getElementById('score-num'),
    bestNum: document.getElementById('best-num'),
    comboBox: document.getElementById('combo-box'),
    comboCount: document.getElementById('combo-count'),
    comboMult: document.getElementById('combo-mult'),
    comboBar: document.getElementById('combo-bar'),
    levelBadge: document.getElementById('level-badge'),
    xpBar: document.getElementById('xp-bar'),
    xpText: document.getElementById('xp-text'),
    waveBanner: document.getElementById('wave-banner'),
    bannerSub: document.getElementById('banner-sub'),
    bannerTitle: document.getElementById('banner-title'),

    titleScreen: document.getElementById('title-screen'),
    startBestScore: document.getElementById('start-best-score'),
    startBestWave: document.getElementById('start-best-wave'),
    startBtn: document.getElementById('start-btn'),

    levelupScreen: document.getElementById('levelup-screen'),
    levelupLv: document.getElementById('levelup-lv'),
    blessingCards: document.getElementById('blessing-cards'),

    pauseScreen: document.getElementById('pause-screen'),
    autocastToggle: document.getElementById('autocast-toggle'),
    autocastState: document.getElementById('autocast-state'),
    pauseMuteToggle: document.getElementById('pause-mute-toggle'),
    pauseMuteState: document.getElementById('pause-mute-state'),
    pauseBlessingsGrid: document.getElementById('pause-blessings-grid'),
    pauseBlessingsCount: document.getElementById('pause-blessings-count'),
    resumeBtn: document.getElementById('resume-btn'),
    restartPauseBtn: document.getElementById('restart-pause-btn'),
    homePauseBtn: document.getElementById('home-pause-btn'),

    endScreen: document.getElementById('end-screen'),
    endEyebrow: document.getElementById('end-eyebrow'),
    endTitle: document.getElementById('end-title'),
    endDesc: document.getElementById('end-desc'),
    newRecordBadge: document.getElementById('new-record-badge'),
    endScore: document.getElementById('end-score'),
    endWave: document.getElementById('end-wave'),
    endKills: document.getElementById('end-kills'),
    endCombo: document.getElementById('end-combo'),
    endLevel: document.getElementById('end-level'),
    endlessBtn: document.getElementById('endless-btn'),
    retryBtn: document.getElementById('retry-btn'),
    homeEndBtn: document.getElementById('home-end-btn'),

    muteBtn: document.getElementById('mute-btn'),
    pauseBtn: document.getElementById('pause-btn'),
  };

  // =========================================================================
  // Asset Preloader & Offscreen Hit-Flash Buffer
  // =========================================================================
  const images = {};
  let assetsReady = false;

  const flashCanvas = document.createElement('canvas');
  flashCanvas.width = 256;
  flashCanvas.height = 256;
  const flashCtx = flashCanvas.getContext('2d');

  function preloadAssets() {
    const entries = Object.entries(ASSET_MANIFEST);
    let loaded = 0;
    return new Promise((resolve) => {
      entries.forEach(([key, src]) => {
        const img = new Image();
        img.onload = () => {
          loaded += 1;
          if (loaded === entries.length) {
            assetsReady = true;
            resolve();
          }
        };
        img.onerror = () => {
          loaded += 1;
          if (loaded === entries.length) {
            assetsReady = true;
            resolve();
          }
        };
        img.src = src;
        images[key] = img;
      });
    });
  }

  function isImgReady(img) {
    return Boolean(img && img.complete && img.naturalWidth > 0);
  }

  // =========================================================================
  // Procedural Fantasy Web Audio Synthesizer
  // =========================================================================
  class ArcaneAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.noiseBuffer = null;
      this.lastPlayed = {
        cast: -1,
        hit: -1,
        kill: -1,
        mana: -1,
      };
    }

    _canPlay(key, minInterval) {
      if (!this._ready()) return false;
      const now = this.ctx.currentTime;
      if (now - (this.lastPlayed[key] || -1) < minInterval) return false;
      this.lastPlayed[key] = now;
      return true;
    }

    unlock() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.34;
        this.master.connect(this.ctx.destination);
        this.noiseBuffer = this._createNoiseBuffer();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    }

    setMuted(muted) {
      this.muted = muted;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(muted ? 0 : 0.34, this.ctx.currentTime, 0.02);
      }
    }

    _createNoiseBuffer() {
      const length = this.ctx.sampleRate * 0.5;
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    }

    _ready() {
      return Boolean(this.ctx && !this.muted && this.ctx.state === 'running');
    }

    playCast() {
      if (!this._canPlay('cast', 0.06)) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(760 + Math.random() * 90, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.085);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.095);

      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2400, now);
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.05, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        src.connect(bp);
        bp.connect(ng);
        ng.connect(this.master);
        src.start(now);
        src.stop(now + 0.055);
      }
    }

    playBurst() {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      [220, 440, 660].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq * 1.4, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.55, now + 0.24);
        gain.gain.setValueAtTime(idx === 0 ? 0.16 : 0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(2800, now);
        lp.frequency.exponentialRampToValueAtTime(600, now + 0.24);

        osc.connect(lp);
        lp.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.26);
      });
    }

    playBlink() {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 3.2;
        bp.frequency.setValueAtTime(600, now);
        bp.frequency.exponentialRampToValueAtTime(3400, now + 0.15);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        src.connect(bp);
        bp.connect(gain);
        gain.connect(this.master);
        src.start(now);
        src.stop(now + 0.19);
      }

      const chime = this.ctx.createOscillator();
      const cg = this.ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(1046.5, now + 0.02);
      chime.frequency.exponentialRampToValueAtTime(1568, now + 0.18);
      cg.gain.setValueAtTime(0.12, now + 0.02);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      chime.connect(cg);
      cg.connect(this.master);
      chime.start(now + 0.02);
      chime.stop(now + 0.25);
    }

    playHit(heavy = false) {
      if (!this._canPlay('hit', heavy ? 0.03 : 0.045)) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(heavy ? 140 : 210, now);
      osc.frequency.exponentialRampToValueAtTime(58, now + 0.08);
      gain.gain.setValueAtTime(heavy ? 0.18 : 0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.09);
    }

    playKill(isGolem = false) {
      if (isGolem ? !this._ready() : !this._canPlay('kill', 0.05)) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isGolem ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(isGolem ? 110 : 290, now);
      osc.frequency.exponentialRampToValueAtTime(isGolem ? 36 : 90, now + (isGolem ? 0.28 : 0.13));

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(isGolem ? 520 : 1200, now);

      gain.gain.setValueAtTime(isGolem ? 0.3 : 0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isGolem ? 0.3 : 0.14));
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + (isGolem ? 0.31 : 0.15));
    }

    playShieldBreak() {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      [880, 622, 160].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = i === 2 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + 0.24);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + 0.26);
      });
    }

    playManaPickup(combo) {
      if (!this._canPlay('mana', 0.045)) return;
      const now = this.ctx.currentTime;
      const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];
      const step = Math.min(8, Math.floor(combo / 2));
      const freq = pentatonic[step];

      const osc = this.ctx.createOscillator();
      const overtone = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2, now);

      gain.gain.setValueAtTime(0.13, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      const overGain = this.ctx.createGain();
      overGain.gain.value = 0.25;

      osc.connect(gain);
      overtone.connect(overGain);
      overGain.connect(gain);
      gain.connect(this.master);

      osc.start(now);
      overtone.start(now);
      osc.stop(now + 0.23);
      overtone.stop(now + 0.23);
    }

    playPowerup() {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.055;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    }

    playLevelUp() {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
      notes.forEach((freq, i) => {
        const t = now + i * 0.065;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.44);
      });
    }

    playWaveClear() {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      [440, 554.37, 659.25].forEach((freq, i) => {
        const t = now + i * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.35);
      });
    }

    playBossHorn() {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      [98.0, 146.83].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const lp = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * 0.96, now);
        osc.frequency.linearRampToValueAtTime(freq, now + 0.2);
        osc.frequency.linearRampToValueAtTime(freq * 0.92, now + 1.05);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(320, now);
        lp.frequency.linearRampToValueAtTime(640, now + 0.28);
        lp.frequency.linearRampToValueAtTime(280, now + 1.05);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(idx === 0 ? 0.24 : 0.14, now + 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

        osc.connect(lp);
        lp.connect(gain);
        gain.connect(this.master);
        osc.start(now);
        osc.stop(now + 1.18);
      });
    }

    playPlayerHurt() {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(62, now + 0.2);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(620, now);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.23);
    }

    playAltarActivate() {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      [392.0, 587.33, 783.99].forEach((freq, i) => {
        const t = now + i * 0.06;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.11, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    }

    playAltarHum(progress) {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const freq = 420 + progress * 440;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, now + 0.14);
      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.16);
    }

    playAltarPulse() {
      if (!this._ready()) return;
      const now = this.ctx.currentTime;
      // Triumphant crystalline purification chord
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const t = now + i * 0.035;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = i % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.58);
      });
      // Deep shockwave thump
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(150, now);
      sub.frequency.exponentialRampToValueAtTime(42, now + 0.34);
      subGain.gain.setValueAtTime(0.24, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      sub.connect(subGain);
      subGain.connect(this.master);
      sub.start(now);
      sub.stop(now + 0.38);
    }
  }

  const audio = new ArcaneAudio();

  // =========================================================================
  // Persistent Records & Settings
  // =========================================================================
  const records = {
    highScore: parseInt(localStorage.getItem(STORAGE_KEYS.highScore) || '0', 10) || 0,
    bestWave: parseInt(localStorage.getItem(STORAGE_KEYS.bestWave) || '0', 10) || 0,
  };

  function saveRecords(score, wave) {
    let beatRecord = false;
    if (score > records.highScore) {
      records.highScore = score;
      localStorage.setItem(STORAGE_KEYS.highScore, String(score));
      beatRecord = true;
    }
    if (wave > records.bestWave) {
      records.bestWave = wave;
      localStorage.setItem(STORAGE_KEYS.bestWave, String(wave));
      beatRecord = true;
    }
    return beatRecord;
  }

  // =========================================================================
  // Game State
  // =========================================================================
  let gameState = 'TITLE'; // TITLE | PLAYING | LEVEL_UP | PAUSED | END
  let autoCastEnabled = true;

  const keys = new Set();
  const mouse = {
    viewX: VIEW_W * 0.5,
    viewY: VIEW_H * 0.5,
    worldX: WORLD_W * 0.5,
    worldY: WORLD_H * 0.5,
    leftDown: false,
  };

  const camera = {
    x: (WORLD_W - VIEW_W) * 0.5,
    y: (WORLD_H - VIEW_H) * 0.5,
    trauma: 0,
    shakeX: 0,
    shakeY: 0,
  };

  let worldTime = 0;
  let hitStopTimer = 0;
  let slowMoTimer = 0;
  let bannerTimer = 0;

  let run = null;

  function createInitialRun() {
    return {
      score: 0,
      wave: 1,
      kills: 0,
      combo: 0,
      maxCombo: 0,
      comboTimer: 0,
      level: 1,
      xp: 0,
      nextXp: 100,
      endlessMode: false,
      blessingCounts: {},

      player: {
        x: WORLD_W * 0.5,
        y: 540,
        vx: 0,
        vy: 0,
        facing: -1,
        radius: 16,
        hp: 100,
        maxHp: 100,
        speed: 245,
        invulnTimer: 0,
        graceTimer: 0,
        shields: 0,
        maxShields: 2,

        // Weapons & cooldowns
        fireCooldown: 0,
        baseFireInterval: 0.32,
        fireRateMult: 1,
        damageMult: 1,
        extraProjectiles: 0,
        pierceBonus: 0,

        // Ember Burst (2 charges, 2.2s recharge each)
        burstCharges: 2,
        burstMaxCharges: 2,
        burstRecharge: 0,
        burstBaseCd: 2.2,
        burstCdMult: 1,
        burstExtraBolts: 0,

        // Arcane Blink
        blinkCooldown: 0,
        blinkBaseCd: 1.6,
        blinkCdMult: 1,
        blinkTimer: 0,
        blinkDirX: 1,
        blinkDirY: 0,
        blinkAfterimageTick: 0,
        blinkIframeBonus: 0,

        // Pickups & Buffs
        magnetRadius: 135,
        xpMult: 1,
        tomeTimer: 0,
        sigilTimer: 0,
        walkPhase: 0,
        squash: 0,
      },

      waveQueue: [],
      spawnTimer: 0,
      waveTransitionTimer: 0,
      bossTrickleTimer: 5.5,
      bossSpawnPending: false,
      bossSpawnDelay: 0,

      altar: {
        active: false,
        cooldownTimer: ALTAR.firstDelay,
        activeTimer: 0,
        charge: 0,
        graceTimer: 0,
        inside: false,
        humTick: 0,
      },

      enemies: [],
      boss: null,
      playerBullets: [],
      enemyBullets: [],
      pickups: [],
      particles: [],
      afterimages: [],
      shockwaves: [],
      floatingTexts: [],
    };
  }

  // Ambient moonlit fireflies
  const fireflies = Array.from({ length: 34 }, () => ({
    x: GLADE.minX + Math.random() * (GLADE.maxX - GLADE.minX),
    y: GLADE.minY - 50 + Math.random() * (GLADE.maxY - GLADE.minY + 70),
    vx: (Math.random() - 0.5) * 18,
    vy: (Math.random() - 0.5) * 14,
    phase: Math.random() * Math.PI * 2,
    size: 1.5 + Math.random() * 2.2,
    gold: Math.random() < 0.38,
  }));

  // =========================================================================
  // Helpers
  // =========================================================================
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function clampToGlade(x, y, padX = 0, padY = 0) {
    const minX = GLADE.minX + padX;
    const maxX = GLADE.maxX - padX;
    const minY = GLADE.minY + padY;
    const maxY = GLADE.maxY - padY;

    let cx = clamp(x, minX, maxX);
    let cy = clamp(y, minY, maxY);

    const rx = Math.max(1, GLADE.cornerX - padX);
    const ry = Math.max(1, GLADE.cornerY - padY);
    const innerMinX = minX + rx;
    const innerMaxX = maxX - rx;
    const innerMinY = minY + ry;
    const innerMaxY = maxY - ry;

    let cornerCx = null;
    let cornerCy = null;
    if (cx < innerMinX && cy < innerMinY) {
      cornerCx = innerMinX;
      cornerCy = innerMinY;
    } else if (cx > innerMaxX && cy < innerMinY) {
      cornerCx = innerMaxX;
      cornerCy = innerMinY;
    } else if (cx < innerMinX && cy > innerMaxY) {
      cornerCx = innerMinX;
      cornerCy = innerMaxY;
    } else if (cx > innerMaxX && cy > innerMaxY) {
      cornerCx = innerMaxX;
      cornerCy = innerMaxY;
    }

    if (cornerCx !== null) {
      const nx = (cx - cornerCx) / rx;
      const ny = (cy - cornerCy) / ry;
      const d = Math.hypot(nx, ny);
      if (d > 1) {
        cx = cornerCx + (nx / d) * rx;
        cy = cornerCy + (ny / d) * ry;
      }
    }

    return { x: cx, y: cy };
  }

  function isInsideGlade(x, y, padX = 0, padY = 0) {
    const c = clampToGlade(x, y, padX, padY);
    return Math.abs(c.x - x) < 0.01 && Math.abs(c.y - y) < 0.01;
  }

  function getGladeBoundaryProximity(x, y, threshold = 40) {
    if (isInsideGlade(x, y, threshold, threshold)) return 0;
    const inner = clampToGlade(x, y, threshold, threshold);
    return clamp(Math.hypot(x - inner.x, y - inner.y) / threshold, 0, 1);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function getComboMultiplier(combo) {
    if (combo >= 50) return 5.0;
    if (combo >= 30) return 3.0;
    if (combo >= 15) return 2.0;
    if (combo >= 5) return 1.5;
    return 1.0;
  }

  function addTrauma(pixels) {
    // Map pixel intensity (2.5 / 6 / 11) cleanly into trauma [0..1]
    const added = clamp(pixels / 12, 0.1, 1.0);
    camera.trauma = Math.min(1.0, Math.max(camera.trauma, added));
  }

  function addFloatingText(x, y, text, color, size = 15) {
    if (!run) return;
    if (run.floatingTexts.length >= CAPS.maxFloatingTexts) {
      run.floatingTexts.shift();
    }
    run.floatingTexts.push({
      x,
      y,
      vy: -44,
      text,
      color,
      size,
      life: 0.78,
      maxLife: 0.78,
    });
  }

  function spawnParticles(x, y, count, color, speedMin = 60, speedMax = 210, sizeMin = 2, sizeMax = 4.5, dirAngle = null, spread = Math.PI * 2) {
    if (!run) return;
    const room = CAPS.maxParticles - run.particles.length;
    if (room <= 0) return;
    const spawnCount = Math.min(count, room);
    for (let i = 0; i < spawnCount; i++) {
      const ang = dirAngle === null ? Math.random() * Math.PI * 2 : dirAngle + (Math.random() - 0.5) * spread;
      const spd = speedMin + Math.random() * (speedMax - speedMin);
      const life = 0.24 + Math.random() * 0.28;
      run.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        color,
        life,
        maxLife: life,
      });
    }
  }

  function showWaveBanner(sub, title, isBoss = false, duration = 2.0) {
    ui.bannerSub.textContent = sub;
    ui.bannerTitle.textContent = title;
    ui.waveBanner.classList.toggle('boss-alert', isBoss);
    ui.waveBanner.classList.remove('hidden');
    bannerTimer = duration;
  }

  function bumpCombo(amount = 1, timerFloor = 3.5) {
    run.combo += amount;
    if (run.combo > run.maxCombo) run.maxCombo = run.combo;
    run.comboTimer = Math.min(3.5, Math.max(run.comboTimer, timerFloor));
  }

  // =========================================================================
  // Wave Generation
  // =========================================================================
  function buildWaveQueue(wave) {
    const queue = [];
    if (wave === 1) {
      for (let i = 0; i < 14; i++) queue.push('imp');
      return queue;
    }
    if (wave === 2) {
      for (let i = 0; i < 12; i++) queue.push('imp');
      for (let i = 0; i < 6; i++) queue.push('wisp');
    } else if (wave === 3) {
      for (let i = 0; i < 13; i++) queue.push('imp');
      for (let i = 0; i < 7; i++) queue.push('wisp');
      for (let i = 0; i < 4; i++) queue.push('golem');
    } else if (wave % 4 === 0) {
      // Boss wave escort
      const impCount = Math.min(12, 4 + Math.floor(wave / 4));
      for (let i = 0; i < impCount; i++) queue.push('imp');
      if (wave >= 8) queue.push('wisp');
    } else {
      const total = Math.min(CAPS.maxWaveQueue, Math.round(24 * Math.pow(1.16, wave - 3)));
      const golemCount = Math.max(3, Math.floor(total * 0.16));
      const wispCount = Math.max(5, Math.floor(total * 0.28));
      const impCount = Math.max(8, total - golemCount - wispCount);
      for (let i = 0; i < impCount; i++) queue.push('imp');
      for (let i = 0; i < wispCount; i++) queue.push('wisp');
      for (let i = 0; i < golemCount; i++) queue.push('golem');
    }

    // Shuffle cleanly
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  function getGladePerimeterSpawnPoint(padX = 28, padY = 28) {
    const p = run ? run.player : null;
    let best = null;
    let bestDist = -1;

    for (let attempt = 0; attempt < 4; attempt++) {
      const side = Math.floor(Math.random() * 4);
      let rawX;
      let rawY;
      if (side === 0) {
        rawX = GLADE.minX + padX + Math.random() * (GLADE.maxX - GLADE.minX - padX * 2);
        rawY = GLADE.minY + padY;
      } else if (side === 1) {
        rawX = GLADE.minX + padX + Math.random() * (GLADE.maxX - GLADE.minX - padX * 2);
        rawY = GLADE.maxY - padY;
      } else if (side === 2) {
        rawX = GLADE.minX + padX;
        rawY = GLADE.minY + padY + Math.random() * (GLADE.maxY - GLADE.minY - padY * 2);
      } else {
        rawX = GLADE.maxX - padX;
        rawY = GLADE.minY + padY + Math.random() * (GLADE.maxY - GLADE.minY - padY * 2);
      }
      const candidate = clampToGlade(rawX, rawY, padX, padY);
      if (!p) return candidate;

      const d = Math.hypot(candidate.x - p.x, candidate.y - p.y);
      if (d >= 150) return candidate;
      if (d > bestDist) {
        bestDist = d;
        best = candidate;
      }
    }
    return best;
  }

  function spawnEnemy(type, customPos = null) {
    const pos = customPos ? clampToGlade(customPos.x, customPos.y, 26, 26) : getGladePerimeterSpawnPoint(28, 28);
    const wave = run.wave;
    const hpScale = wave <= 3 ? 1 : 1 + (wave - 3) * 0.18;

    const specs = {
      imp: {
        name: '暗影魔蝠',
        spriteKey: 'enemy_imp',
        drawSize: 46,
        radius: 15,
        hp: Math.round(28 * hpScale),
        speed: 175 + Math.min(35, wave * 3),
        contactDamage: 12,
        score: 50,
        kbResist: 0,
      },
      wisp: {
        name: '腐蝕孢靈',
        spriteKey: 'enemy_wisp',
        drawSize: 50,
        radius: 17,
        hp: Math.round(48 * hpScale),
        speed: 105,
        contactDamage: 10,
        score: 90,
        kbResist: 0.15,
      },
      golem: {
        name: '苔蘚巨像',
        spriteKey: 'enemy_golem',
        drawSize: 78,
        radius: 26,
        hp: Math.round(180 * hpScale),
        speed: 68,
        contactDamage: 24,
        score: 220,
        kbResist: 0.75,
      },
    };

    const s = specs[type];
    run.enemies.push({
      type,
      name: s.name,
      spriteKey: s.spriteKey,
      drawSize: s.drawSize,
      radius: s.radius,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      kbVx: 0,
      kbVy: 0,
      hp: s.hp,
      maxHp: s.hp,
      speed: s.speed,
      contactDamage: s.contactDamage,
      score: s.score,
      kbResist: s.kbResist,
      facing: type === 'golem' ? -1 : 1,
      inGlade: true,
      spawnTimer: 0.65,
      spawnDuration: 0.65,
      spawnPop: 0,
      flashTimer: 0,
      seed: Math.random() * Math.PI * 2,
      // Wisp ranged AI
      attackTimer: 1.2 + Math.random() * 1.1,
      chargeTimer: 0,
      strafeDir: Math.random() < 0.5 ? 1 : -1,
    });
  }

  function spawnBoss() {
    const tier = Math.max(0, Math.floor((run.wave - 4) / 4));
    const maxHp = Math.round(1400 * Math.pow(1.65, tier));
    run.boss = {
      name: '枯棘古樹王',
      spriteKey: 'boss_thornwood',
      drawSize: 148,
      radius: 46,
      x: WORLD_W * 0.5,
      y: GLADE.minY + 55,
      hp: maxHp,
      maxHp,
      phase: 1,
      contactDamage: 28,
      score: 2000 + tier * 1000,
      facing: 1,
      flashTimer: 0,

      state: 'approach', // approach | volley_charge | volley_fire | dash_charge | dashing
      stateTimer: 1.6,
      nextSkill: 'volley',
      volleyCount: 0,
      volleySubTimer: 0,
      dashAngle: Math.PI * 0.5,
      summonTimer: 7.5,
    };

    run.shockwaves.push({
      x: run.boss.x,
      y: run.boss.y,
      radius: 20,
      maxRadius: 210,
      color: PALETTE.blight,
      life: 0.5,
      maxLife: 0.5,
    });
    addTrauma(8);
  }

  function startWave(waveNum) {
    run.wave = waveNum;
    run.waveQueue = buildWaveQueue(waveNum);
    run.spawnTimer = 0.4;
    run.bossTrickleTimer = 6.5;

    const isBoss = waveNum % 4 === 0;
    if (isBoss) {
      showWaveBanner('林地腐化警報', '⚠ 腐化主宰降臨：枯棘古樹王 ⚠', true, 2.2);
      audio.playBossHorn();
      run.bossSpawnPending = true;
      run.bossSpawnDelay = 2.0;
    } else {
      showWaveBanner(`WAVE ${waveNum}`, `第 ${waveNum} 波魔潮來襲`, false, 2.0);
      run.bossSpawnPending = false;
    }
  }

  // =========================================================================
  // Pickups & Drops
  // =========================================================================
  function spawnPickup(type, x, y, life = 22, customVx = null, customVy = null) {
    if (run.pickups.length >= CAPS.maxPickups) {
      const oldestManaIdx = run.pickups.findIndex((it) => it.type === 'mana');
      if (oldestManaIdx !== -1) {
        run.pickups.splice(oldestManaIdx, 1);
      } else {
        run.pickups.shift();
      }
    }
    const pos = clampToGlade(x, y, 16, 16);
    run.pickups.push({
      type,
      x: pos.x,
      y: pos.y,
      vx: customVx !== null ? customVx : (Math.random() - 0.5) * 90,
      vy: customVy !== null ? customVy : (Math.random() - 0.5) * 90,
      life,
      maxLife: life,
      seed: Math.random() * Math.PI * 2,
    });
  }

  function dropLootFromEnemy(enemy) {
    if (enemy.type === 'golem') {
      for (let i = 0; i < 3; i++) {
        spawnPickup('mana', enemy.x + (Math.random() - 0.5) * 34, enemy.y + (Math.random() - 0.5) * 34);
      }
      if (Math.random() < 0.72) {
        const pool = ['tome', 'sigil', 'shield', 'herb'];
        const pick = pool[Math.floor(Math.random() * pool.length)];
        spawnPickup(pick, enemy.x, enemy.y);
      }
      return;
    }

    spawnPickup('mana', enemy.x, enemy.y);
    const specialChance = enemy.type === 'wisp' ? 0.13 : 0.055;
    if (Math.random() < specialChance) {
      const pool = ['tome', 'sigil', 'shield', 'herb'];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      spawnPickup(pick, enemy.x + 12, enemy.y - 8);
    }
  }

  function applyPickup(item) {
    const p = run.player;
    if (item.type === 'mana') {
      bumpCombo(1, Math.min(3.5, run.comboTimer + 1.5));
      const mult = getComboMultiplier(run.combo);
      const pts = Math.round(25 * mult);
      const xpGain = Math.round(15 * p.xpMult);
      run.score += pts;
      gainXp(xpGain);
      audio.playManaPickup(run.combo);
      addFloatingText(p.x, p.y - 26, `+${pts}`, PALETTE.cyan, 14);
      spawnParticles(item.x, item.y, 7, PALETTE.cyan, 50, 140, 2, 3.5);
      return;
    }

    audio.playPowerup();
    if (item.type === 'tome') {
      p.tomeTimer = 10;
      addFloatingText(p.x, p.y - 32, '秘法過載 10s！', PALETTE.gold, 16);
      spawnParticles(p.x, p.y, 14, PALETTE.gold, 80, 200, 2.5, 4.5);
    } else if (item.type === 'sigil') {
      p.sigilTimer = 10;
      p.burstCharges = Math.min(p.burstMaxCharges, p.burstCharges + 1);
      if (p.burstCharges >= p.burstMaxCharges) p.burstRecharge = 0;
      addFloatingText(p.x, p.y - 32, '三連齊射 + 連爆充能！', PALETTE.cyan, 16);
      spawnParticles(p.x, p.y, 14, PALETTE.blight, 80, 200, 2.5, 4.5);
    } else if (item.type === 'shield') {
      if (p.shields < p.maxShields) {
        p.shields += 1;
        addFloatingText(p.x, p.y - 32, '獲得秘法護盾！', PALETTE.cyan, 16);
      } else {
        run.score += 200;
        addFloatingText(p.x, p.y - 32, '護盾滿層 +200', PALETTE.cyan, 15);
      }
      spawnParticles(p.x, p.y, 14, PALETTE.cyan, 70, 180, 2.5, 4);
    } else if (item.type === 'herb') {
      if (p.hp < p.maxHp) {
        const healed = Math.min(30, p.maxHp - p.hp);
        p.hp += healed;
        addFloatingText(p.x, p.y - 32, `+${healed}`, PALETTE.heal, 17);
      } else {
        run.score += 300;
        addFloatingText(p.x, p.y - 32, '滿血淨化 +300', PALETTE.heal, 15);
      }
      spawnParticles(p.x, p.y, 12, PALETTE.heal, 60, 170, 2.5, 4);
    }
  }

  // =========================================================================
  // XP & Level-Up Rune Blessing Draft
  // =========================================================================
  let currentDraftChoices = [];

  function gainXp(amount) {
    run.xp += amount;
    if (run.xp >= run.nextXp && gameState === 'PLAYING') {
      run.xp -= run.nextXp;
      run.level += 1;
      run.nextXp = 100 + (run.level - 1) * 55;
      openLevelUpModal();
    }
  }

  function openLevelUpModal() {
    gameState = 'LEVEL_UP';
    keys.clear();
    mouse.leftDown = false;
    canvas.classList.remove('playing-reticle');
    audio.playLevelUp();

    // Pick 3 distinct random blessings
    const pool = [...BLESSINGS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    currentDraftChoices = pool.slice(0, 3);

    ui.levelupLv.textContent = `LV. ${run.level}`;
    ui.blessingCards.innerHTML = '';

    currentDraftChoices.forEach((b, idx) => {
      const rank = run.blessingCounts[b.id] || 0;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'blessing-card';
      card.innerHTML = `
        <div class="blessing-card-inner">
          <div class="blessing-top">
            <div class="blessing-icon-box"><img src="${b.icon}" alt="${b.name}" /></div>
            <span class="blessing-hotkey">[${idx + 1}]</span>
          </div>
          <div class="blessing-name">
            <span>${b.name}</span>
            <span class="blessing-rank">${rank > 0 ? `Lv.${rank} → Lv.${rank + 1}` : '新覺醒'}</span>
          </div>
          <div class="blessing-desc">${b.desc}</div>
        </div>
      `;
      card.addEventListener('click', () => chooseBlessing(idx));
      ui.blessingCards.appendChild(card);
    });

    ui.levelupScreen.classList.remove('hidden');
  }

  function chooseBlessing(index) {
    if (gameState !== 'LEVEL_UP') return;
    const blessing = currentDraftChoices[index];
    if (!blessing) return;

    blessing.apply(run.player);
    run.blessingCounts[blessing.id] = (run.blessingCounts[blessing.id] || 0) + 1;
    syncBlessingsUI();
    ui.levelupScreen.classList.add('hidden');
    gameState = 'PLAYING';
    canvas.classList.add('playing-reticle');
    run.player.graceTimer = 0.35;
    addFloatingText(run.player.x, run.player.y - 38, `獲得：${blessing.name}`, PALETTE.gold, 16);
    spawnParticles(run.player.x, run.player.y, 16, PALETTE.gold, 90, 220, 2.5, 4.5);

    // Chain level-up if leftover XP still exceeds next threshold
    if (run.xp >= run.nextXp) {
      gainXp(0);
    }
  }

  // =========================================================================
  // Player Combat Actions
  // =========================================================================
  function getAimAngle() {
    const p = run.player;
    return Math.atan2(mouse.worldY - p.y, mouse.worldX - p.x);
  }

  function fireMainWeapon() {
    const p = run.player;
    const baseAngle = getAimAngle();
    const tomeRate = p.tomeTimer > 0 ? 1.5 : 1.0;
    const tomeDmg = p.tomeTimer > 0 ? 1.25 : 1.0;
    const sigilBolts = p.sigilTimer > 0 ? 2 : 0;

    const count = 1 + p.extraProjectiles + sigilBolts;
    const spreadStep = count >= 5 ? 0.11 : 0.14;
    const dmg = Math.round(20 * p.damageMult * tomeDmg);
    const interval = Math.max(0.085, p.baseFireInterval / (p.fireRateMult * tomeRate));

    p.fireCooldown = interval;
    p.squash = 0.14;

    for (let i = 0; i < count; i++) {
      if (run.playerBullets.length >= CAPS.maxPlayerBullets) break;
      const offset = (i - (count - 1) * 0.5) * spreadStep;
      const ang = baseAngle + offset;
      const spd = 680;
      run.playerBullets.push({
        x: p.x + Math.cos(ang) * 20,
        y: p.y + Math.sin(ang) * 20,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        speed: spd,
        damage: dmg,
        pierce: p.pierceBonus,
        hitIds: new Set(),
        knockback: 75,
        isBurst: false,
        drawSize: 28,
        radius: 10,
        life: 1.5,
      });
    }

    audio.playCast();
  }

  function triggerEmberBurst() {
    if (gameState !== 'PLAYING' || !run) return;
    const p = run.player;
    if (p.burstCharges <= 0) return;

    p.burstCharges -= 1;
    const baseAngle = getAimAngle();
    const tomeDmg = p.tomeTimer > 0 ? 1.25 : 1.0;
    const dmg = Math.round(32 * p.damageMult * tomeDmg);
    const totalBolts = 5 + p.burstExtraBolts;
    const totalSpread = Math.min(0.95, 0.56 + p.burstExtraBolts * 0.08);

    for (let i = 0; i < totalBolts; i++) {
      const t = totalBolts === 1 ? 0 : i / (totalBolts - 1) - 0.5;
      const ang = baseAngle + t * totalSpread;
      const spd = 740;
      run.playerBullets.push({
        x: p.x + Math.cos(ang) * 22,
        y: p.y + Math.sin(ang) * 22,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        speed: spd,
        damage: dmg,
        pierce: 1 + p.pierceBonus,
        hitIds: new Set(),
        knockback: 185,
        isBurst: true,
        drawSize: 32,
        radius: 13,
        life: 1.25,
      });
    }

    p.squash = 0.22;
    addTrauma(2.5);
    spawnParticles(p.x + Math.cos(baseAngle) * 24, p.y + Math.sin(baseAngle) * 24, 12, PALETTE.gold, 110, 260, 2.5, 5, baseAngle, 0.9);
    audio.playBurst();
  }

  function triggerArcaneBlink() {
    if (gameState !== 'PLAYING' || !run) return;
    const p = run.player;
    if (p.blinkCooldown > 0 || p.blinkTimer > 0) return;

    let dx = 0;
    let dy = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;

    if (dx === 0 && dy === 0) {
      const ang = getAimAngle();
      dx = Math.cos(ang);
      dy = Math.sin(ang);
    } else {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    p.blinkDirX = dx;
    p.blinkDirY = dy;
    p.blinkTimer = 0.16;
    p.blinkAfterimageTick = 0;
    p.invulnTimer = Math.max(p.invulnTimer, 0.28 + p.blinkIframeBonus);
    p.blinkCooldown = p.blinkBaseCd * p.blinkCdMult;
    p.squash = 0.24;

    spawnParticles(p.x, p.y, 10, PALETTE.cyan, 80, 210, 2, 4);
    audio.playBlink();
  }

  function damagePlayer(amount, srcX, srcY) {
    const p = run.player;
    if (p.invulnTimer > 0 || p.graceTimer > 0 || gameState !== 'PLAYING') return;

    if (p.shields > 0) {
      p.shields -= 1;
      p.invulnTimer = 0.7;
      addTrauma(5);
      audio.playShieldBreak();
      addFloatingText(p.x, p.y - 30, '護盾抵擋！', PALETTE.cyan, 16);
      run.shockwaves.push({
        x: p.x,
        y: p.y,
        radius: 18,
        maxRadius: 175,
        color: PALETTE.cyan,
        life: 0.36,
        maxLife: 0.36,
      });
      spawnParticles(p.x, p.y, 18, PALETTE.cyan, 120, 280, 2.5, 5);

      // Push nearby enemies & clear nearby enemy bullets
      for (const e of run.enemies) {
        if (e.spawnTimer > 0) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 185) {
          const push = 360 * (1 - e.kbResist);
          e.kbVx += (dx / dist) * push;
          e.kbVy += (dy / dist) * push;
        }
      }
      run.enemyBullets = run.enemyBullets.filter((b) => Math.hypot(b.x - p.x, b.y - p.y) > 160);
      return;
    }

    p.hp = Math.max(0, p.hp - amount);
    p.invulnTimer = 0.8;
    addTrauma(6);
    audio.playPlayerHurt();
    addFloatingText(p.x, p.y - 28, `-${amount}`, PALETTE.crimson, 18);
    spawnParticles(p.x, p.y, 12, PALETTE.crimson, 90, 240, 2.5, 4.5);

    if (srcX !== undefined && srcY !== undefined) {
      const dx = p.x - srcX;
      const dy = p.y - srcY;
      const len = Math.hypot(dx, dy) || 1;
      const clamped = clampToGlade(p.x + (dx / len) * 14, p.y + (dy / len) * 14);
      p.x = clamped.x;
      p.y = clamped.y;
    }

    if (p.hp <= 0) {
      triggerEndScreen(false);
    }
  }

  // =========================================================================
  // Enemy & Boss Damage / Defeat
  // =========================================================================
  function damageTarget(target, dmg, knockX, knockY, isBurst, isBoss = false) {
    target.hp -= dmg;
    target.flashTimer = 0.07; // 70ms pure white hit flash

    if (!isBoss && target.kbResist !== undefined) {
      const mult = 1 - target.kbResist;
      target.kbVx += knockX * mult;
      target.kbVy += knockY * mult;
    }

    const color = isBurst ? PALETTE.gold : PALETTE.text;
    const size = isBurst ? 17 : 14;
    addFloatingText(
      target.x + (Math.random() - 0.5) * 16,
      target.y - target.radius - 6,
      String(dmg),
      color,
      size
    );

    const hitAngle = Math.atan2(knockY, knockX);
    spawnParticles(target.x, target.y, isBurst ? 9 : 6, isBurst ? PALETTE.gold : '#FFB347', 90, 220, 2, 4, hitAngle, 1.3);
    audio.playHit(isBurst);

    if (target.hp <= 0) {
      if (isBoss) {
        handleBossDefeat(target);
      } else {
        handleEnemyDefeat(target, isBurst);
      }
      return true;
    }
    return false;
  }

  function handleEnemyDefeat(enemy, byBurst) {
    run.kills += 1;
    bumpCombo(1, 3.5);
    const mult = getComboMultiplier(run.combo);
    const pts = Math.round(enemy.score * mult);
    run.score += pts;

    dropLootFromEnemy(enemy);
    audio.playKill(enemy.type === 'golem');

    if (enemy.type === 'golem') {
      hitStopTimer = Math.max(hitStopTimer, 0.035);
      addTrauma(6);
      run.shockwaves.push({
        x: enemy.x,
        y: enemy.y,
        radius: 16,
        maxRadius: 120,
        color: PALETTE.blight,
        life: 0.35,
        maxLife: 0.35,
      });
      spawnParticles(enemy.x, enemy.y, 18, PALETTE.blight, 80, 250, 3, 5.5);
    } else {
      if (byBurst) hitStopTimer = Math.max(hitStopTimer, 0.035);
      spawnParticles(enemy.x, enemy.y, 10, enemy.type === 'wisp' ? PALETTE.blight : '#C084FC', 70, 200, 2, 4);
    }
  }

  function handleBossDefeat(boss) {
    run.kills += 1;
    bumpCombo(5, 3.5);
    const mult = getComboMultiplier(run.combo);
    const pts = Math.round(boss.score * mult);
    run.score += pts;

    hitStopTimer = 0.09; // 90ms hit-stop
    slowMoTimer = 0.42;
    addTrauma(11);
    audio.playKill(true);

    run.shockwaves.push({
      x: boss.x,
      y: boss.y,
      radius: 26,
      maxRadius: 280,
      color: PALETTE.gold,
      life: 0.65,
      maxLife: 0.65,
    });
    spawnParticles(boss.x, boss.y, 38, PALETTE.gold, 90, 340, 3, 6.5);
    spawnParticles(boss.x, boss.y, 28, PALETTE.blight, 70, 280, 3, 6);

    // Clear remaining enemy projectiles & burst loot fountain inside GLADE
    run.enemyBullets = [];
    const origin = clampToGlade(boss.x, boss.y, 26, 26);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
      const spd = 480 + Math.random() * 140;
      spawnPickup(
        'mana',
        origin.x + Math.cos(ang) * 14,
        origin.y + Math.sin(ang) * 14,
        30,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd
      );
    }
    const rarePool = ['tome', 'sigil', 'shield'];
    const rarePick = rarePool[Math.floor(Math.random() * rarePool.length)];
    const rareAng = Math.random() * Math.PI * 2;
    spawnPickup(rarePick, origin.x, origin.y, 30, Math.cos(rareAng) * 280, Math.sin(rareAng) * 280);

    addFloatingText(boss.x, boss.y - 40, `枯棘古樹王淨化！ +${pts}`, PALETTE.gold, 22);
    run.boss = null;
  }

  // =========================================================================
  // Update Loop
  // =========================================================================
  function updatePlaying(rawDt) {
    if (hitStopTimer > 0) {
      hitStopTimer = Math.max(0, hitStopTimer - rawDt);
      updateTrauma(rawDt);
      return;
    }

    let dt = rawDt;
    if (slowMoTimer > 0) {
      slowMoTimer = Math.max(0, slowMoTimer - rawDt);
      dt = rawDt * 0.38;
    }

    const p = run.player;

    // Update timers
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.graceTimer > 0) p.graceTimer = Math.max(0, p.graceTimer - dt);
    if (p.tomeTimer > 0) p.tomeTimer = Math.max(0, p.tomeTimer - dt);
    if (p.sigilTimer > 0) p.sigilTimer = Math.max(0, p.sigilTimer - dt);
    if (p.blinkCooldown > 0) p.blinkCooldown = Math.max(0, p.blinkCooldown - dt);
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 1.6);

    // Ember Burst charge recovery
    const burstRechargeTime = p.burstBaseCd * p.burstCdMult;
    if (p.burstCharges < p.burstMaxCharges) {
      p.burstRecharge += dt;
      if (p.burstRecharge >= burstRechargeTime) {
        p.burstRecharge -= burstRechargeTime;
        p.burstCharges += 1;
        if (p.burstCharges >= p.burstMaxCharges) p.burstRecharge = 0;
      }
    }

    // Combo decay
    if (run.combo > 0) {
      run.comboTimer -= dt;
      if (run.comboTimer <= 0) {
        run.combo = 0;
        run.comboTimer = 0;
      }
    }

    // Player movement or Arcane Blink
    if (p.blinkTimer > 0) {
      const prevTimer = p.blinkTimer;
      p.blinkTimer = Math.max(0, p.blinkTimer - dt);
      const step = prevTimer - p.blinkTimer;
      const blinkSpeed = 190 / 0.16;
      const clampedBlink = clampToGlade(p.x + p.blinkDirX * blinkSpeed * step, p.y + p.blinkDirY * blinkSpeed * step);
      p.x = clampedBlink.x;
      p.y = clampedBlink.y;

      p.blinkAfterimageTick -= dt;
      if (p.blinkAfterimageTick <= 0) {
        p.blinkAfterimageTick = 0.04;
        run.afterimages.push({
          x: p.x,
          y: p.y,
          facing: p.facing,
          life: 0.24,
          maxLife: 0.24,
        });
      }
    } else {
      let mx = 0;
      let my = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;

      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        mx /= len;
        my /= len;
        const clampedMove = clampToGlade(p.x + mx * p.speed * dt, p.y + my * p.speed * dt);
        p.x = clampedMove.x;
        p.y = clampedMove.y;
        p.walkPhase += dt * 13;
      } else {
        p.walkPhase = 0;
      }
    }

    // Update world mouse aim & facing (player_warden.png natively faces LEFT)
    mouse.worldX = mouse.viewX + camera.x;
    mouse.worldY = mouse.viewY + camera.y;
    p.facing = mouse.worldX >= p.x ? -1 : 1;

    // Auto-cast or manual primary fire
    if ((autoCastEnabled || mouse.leftDown) && p.fireCooldown <= 0 && p.blinkTimer <= 0) {
      fireMainWeapon();
    }

    // Tome golden aura particles
    if (p.tomeTimer > 0 && Math.random() < 0.35) {
      spawnParticles(p.x + (Math.random() - 0.5) * 28, p.y + (Math.random() - 0.5) * 28, 1, PALETTE.gold, 15, 45, 1.8, 3.2);
    }

    // Update camera smoothly
    const targetCamX = clamp(p.x - VIEW_W * 0.5, 0, WORLD_W - VIEW_W);
    const targetCamY = clamp(p.y - VIEW_H * 0.5, 0, WORLD_H - VIEW_H);
    const camLerp = 1 - Math.exp(-8.5 * dt);
    camera.x = lerp(camera.x, targetCamX, camLerp);
    camera.y = lerp(camera.y, targetCamY, camLerp);
    mouse.worldX = mouse.viewX + camera.x;
    mouse.worldY = mouse.viewY + camera.y;
    updateTrauma(rawDt);

    // Wave spawning & transitions
    updateWaveLogic(dt);
    if (gameState !== 'PLAYING') return;

    // Central Runic Altar Surge
    updateAltar(dt);

    // Update bullets, enemies, boss, pickups, particles
    updatePlayerBullets(dt);
    updateEnemies(dt);
    if (run.boss) updateBoss(dt);
    updateEnemyBullets(dt);
    updatePickups(dt);
    updateVisualEffects(dt);
  }

  function isPlayerInsideAltar(p) {
    const nx = (p.x - ALTAR.x) / ALTAR.rx;
    const ny = (p.y + 16 - ALTAR.y) / ALTAR.ry;
    return nx * nx + ny * ny <= 1.0;
  }

  function updateAltar(dt) {
    const altar = run.altar;
    const p = run.player;
    const inCombat = run.waveQueue.length > 0 || run.enemies.length > 0 || Boolean(run.boss);

    if (!altar.active) {
      if (inCombat) {
        altar.cooldownTimer -= dt;
        if (altar.cooldownTimer <= 0) {
          altar.active = true;
          altar.activeTimer = ALTAR.activeDuration;
          altar.charge = 0;
          altar.graceTimer = 0;
          altar.inside = false;
          altar.humTick = 0;
          audio.playAltarActivate();
          addFloatingText(ALTAR.x, ALTAR.y - ALTAR.ry - 14, '星火祭壇啟動！', PALETTE.gold, 17);
          spawnParticles(ALTAR.x, ALTAR.y, 16, PALETTE.cyan, 60, 170, 2, 3.8);
        }
      }
      return;
    }

    altar.activeTimer -= dt;
    altar.inside = isPlayerInsideAltar(p);

    if (altar.inside) {
      altar.charge = Math.min(1, altar.charge + dt / ALTAR.chargeDuration);
      altar.graceTimer = ALTAR.graceDuration;
      altar.humTick -= dt;
      if (altar.humTick <= 0) {
        altar.humTick = 0.32;
        audio.playAltarHum(altar.charge);
      }
      if (Math.random() < 0.45) {
        const ang = Math.random() * Math.PI * 2;
        spawnParticles(
          ALTAR.x + Math.cos(ang) * ALTAR.rx * 0.85,
          ALTAR.y + Math.sin(ang) * ALTAR.ry * 0.85,
          1,
          Math.random() < 0.5 ? PALETTE.gold : PALETTE.cyan,
          20,
          65,
          2,
          3.6
        );
      }
      if (altar.charge >= 1) {
        triggerAltarPulse();
        altar.active = false;
        altar.activeTimer = 0;
        altar.charge = 0;
        altar.graceTimer = 0;
        altar.inside = false;
        altar.cooldownTimer = ALTAR.cooldownDuration;
        return;
      }
    } else if (altar.graceTimer > 0) {
      altar.graceTimer = Math.max(0, altar.graceTimer - dt);
    } else {
      altar.charge = Math.max(0, altar.charge - dt * 0.32);
    }

    if (altar.activeTimer <= 0) {
      altar.active = false;
      altar.activeTimer = 0;
      altar.charge = 0;
      altar.graceTimer = 0;
      altar.inside = false;
      altar.cooldownTimer = ALTAR.cooldownDuration;
    }
  }

  function triggerAltarPulse() {
    const p = run.player;
    const pulseRadius = 390;
    const pulseDmg = 75 + (run.wave - 1) * 8;

    // Expanding golden-cyan shockwave rings
    run.shockwaves.push({
      x: ALTAR.x,
      y: ALTAR.y,
      radius: 36,
      maxRadius: 430,
      color: PALETTE.gold,
      life: 0.62,
      maxLife: 0.62,
    });
    run.shockwaves.push({
      x: ALTAR.x,
      y: ALTAR.y,
      radius: 24,
      maxRadius: 365,
      color: PALETTE.cyan,
      life: 0.48,
      maxLife: 0.48,
    });
    spawnParticles(ALTAR.x, ALTAR.y, 28, PALETTE.gold, 140, 360, 2.5, 5.2);
    spawnParticles(ALTAR.x, ALTAR.y, 24, PALETTE.cyan, 120, 320, 2.5, 4.8);

    // Heavy radial damage + knockback to nearby materialized enemies
    for (let j = run.enemies.length - 1; j >= 0; j--) {
      const e = run.enemies[j];
      if (e.spawnTimer > 0) continue;
      const dx = e.x - ALTAR.x;
      const dy = e.y - ALTAR.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist <= pulseRadius + e.radius) {
        const kb = 440;
        const died = damageTarget(e, pulseDmg, (dx / dist) * kb, (dy / dist) * kb, true, false);
        if (died) {
          run.enemies.splice(j, 1);
        }
      }
    }

    // Also damage Boss if within pulse radius
    if (run.boss) {
      const boss = run.boss;
      const dist = Math.hypot(boss.x - ALTAR.x, boss.y - ALTAR.y);
      if (dist <= pulseRadius + boss.radius) {
        damageTarget(boss, pulseDmg, 0, 0, true, true);
        checkBossPhase2();
      }
    }

    // Clear enemy projectiles caught in the purification pulse
    run.enemyBullets = run.enemyBullets.filter((b) => Math.hypot(b.x - ALTAR.x, b.y - ALTAR.y) > pulseRadius);

    // Restore +1 Ember Burst charge, +15 HP, +300 bonus score
    p.burstCharges = Math.min(p.burstMaxCharges, p.burstCharges + 1);
    if (p.burstCharges >= p.burstMaxCharges) p.burstRecharge = 0;

    const healed = Math.min(15, p.maxHp - p.hp);
    p.hp += healed;
    run.score += 300;

    addFloatingText(ALTAR.x, ALTAR.y - 46, '星火淨化脈衝！', PALETTE.gold, 20);
    if (healed > 0) {
      addFloatingText(p.x, p.y - 34, `+${healed} HP · +300`, PALETTE.heal, 15);
    } else {
      addFloatingText(p.x, p.y - 34, '+300 淨化加分', PALETTE.cyan, 15);
    }

    hitStopTimer = Math.max(hitStopTimer, 0.035);
    addTrauma(4);
    audio.playAltarPulse();
  }

  function updateTrauma(dt) {
    if (camera.trauma > 0) {
      camera.trauma = Math.max(0, camera.trauma - dt * 2.1);
      const mag = camera.trauma * camera.trauma * 12;
      camera.shakeX = (Math.random() * 2 - 1) * mag;
      camera.shakeY = (Math.random() * 2 - 1) * mag;
    } else {
      camera.shakeX = 0;
      camera.shakeY = 0;
    }
  }

  function updateWaveLogic(dt) {
    if (run.waveTransitionTimer > 0) {
      run.waveTransitionTimer -= dt;
      if (run.waveTransitionTimer <= 0) {
        startWave(run.wave + 1);
      }
      return;
    }

    if (run.bossSpawnPending) {
      run.bossSpawnDelay -= dt;
      if (run.bossSpawnDelay <= 0) {
        run.bossSpawnPending = false;
        spawnBoss();
      }
    }

    if (run.waveQueue.length > 0) {
      run.spawnTimer -= dt;
      if (run.spawnTimer <= 0) {
        const room = Math.max(0, CAPS.maxActiveEnemies - run.enemies.length);
        if (room > 0) {
          const batch = Math.min(room, run.wave === 1 ? 2 : 3, run.waveQueue.length);
          for (let i = 0; i < batch && run.waveQueue.length > 0; i++) {
            spawnEnemy(run.waveQueue.shift());
          }
          run.spawnTimer = Math.max(0.52, 1.35 - run.wave * 0.08);
        } else {
          run.spawnTimer = 0.25;
        }
      }
    }

    // Boss wave trickle spawns to maintain tempo & mana drops
    if (run.boss && !run.bossSpawnPending) {
      run.bossTrickleTimer -= dt;
      if (run.bossTrickleTimer <= 0) {
        run.bossTrickleTimer = 8.0;
        if (run.enemies.length < 9) {
          spawnEnemy('imp');
          spawnEnemy('imp');
        }
      }
    }

    // Check wave completion
    const waveCleared =
      run.waveQueue.length === 0 &&
      !run.bossSpawnPending &&
      !run.boss &&
      run.enemies.length === 0;

    if (waveCleared) {
      const mult = getComboMultiplier(run.combo);
      const bonus = Math.round(run.wave * 250 * mult);
      run.score += bonus;
      saveRecords(run.score, run.wave);
      audio.playWaveClear();

      const p = run.player;
      if (p.hp < p.maxHp) {
        const heal = Math.min(12, p.maxHp - p.hp);
        p.hp += heal;
        addFloatingText(p.x, p.y - 42, `波次淨化 +${bonus} | +${heal} HP`, PALETTE.heal, 16);
      } else {
        addFloatingText(p.x, p.y - 42, `波次淨化獎勵 +${bonus}`, PALETTE.gold, 16);
      }

      if (run.wave === 8 && !run.endlessMode) {
        triggerEndScreen(true);
        return;
      }

      run.waveTransitionTimer = 1.65;
    }
  }

  function updatePlayerBullets(dt) {
    const p = run.player;
    for (let i = run.playerBullets.length - 1; i >= 0; i--) {
      const b = run.playerBullets[i];
      b.life -= dt;

      // Subtle homing on standard arcane bolts
      if (!b.isBurst) {
        let nearest = null;
        let bestDist = 175;
        for (const e of run.enemies) {
          if (e.spawnTimer > 0 || b.hitIds.has(e)) continue;
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < bestDist) {
            bestDist = d;
            nearest = e;
          }
        }
        if (run.boss && !b.hitIds.has(run.boss)) {
          const d = Math.hypot(run.boss.x - b.x, run.boss.y - b.y);
          if (d < bestDist + 30) nearest = run.boss;
        }
        if (nearest) {
          const desired = Math.atan2(nearest.y - b.y, nearest.x - b.x);
          const current = Math.atan2(b.vy, b.vx);
          const diff = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
          const maxTurn = 1.65 * dt;
          const nextAngle = current + clamp(diff, -maxTurn, maxTurn);
          b.vx = Math.cos(nextAngle) * b.speed;
          b.vy = Math.sin(nextAngle) * b.speed;
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (Math.random() < 0.45) {
        run.particles.push({
          x: b.x - (b.vx / b.speed) * 10,
          y: b.y - (b.vy / b.speed) * 10,
          vx: (Math.random() - 0.5) * 24,
          vy: (Math.random() - 0.5) * 24,
          size: b.isBurst ? 3.2 : 2.1,
          color: b.isBurst ? PALETTE.gold : '#FFD28A',
          life: 0.16,
          maxLife: 0.16,
        });
      }

      if (b.life <= 0 || b.x < 40 || b.x > WORLD_W - 40 || b.y < 140 || b.y > WORLD_H - 20) {
        run.playerBullets.splice(i, 1);
        continue;
      }

      let removed = false;

      // Hit enemies
      for (let j = run.enemies.length - 1; j >= 0; j--) {
        const e = run.enemies[j];
        if (e.spawnTimer > 0 || b.hitIds.has(e)) continue;
        const dist = Math.hypot(e.x - b.x, e.y - b.y);
        if (dist <= e.radius + b.radius) {
          b.hitIds.add(e);
          const kbDirX = (b.vx / b.speed) * b.knockback;
          const kbDirY = (b.vy / b.speed) * b.knockback;
          const died = damageTarget(e, b.damage, kbDirX, kbDirY, b.isBurst, false);
          if (died) {
            run.enemies.splice(j, 1);
          }

          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            run.playerBullets.splice(i, 1);
            removed = true;
            break;
          }
        }
      }

      if (removed) continue;

      // Hit Boss
      if (run.boss && !b.hitIds.has(run.boss)) {
        const boss = run.boss;
        const dist = Math.hypot(boss.x - b.x, boss.y - b.y);
        if (dist <= boss.radius + b.radius) {
          b.hitIds.add(boss);
          damageTarget(boss, b.damage, b.vx / b.speed, b.vy / b.speed, b.isBurst, true);
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            run.playerBullets.splice(i, 1);
          }
        }
      }
    }

    // Check if Boss entered Phase 2 (< 50% HP)
    checkBossPhase2();
  }

  function checkBossPhase2() {
    if (run.boss && run.boss.phase === 1 && run.boss.hp < run.boss.maxHp * 0.5) {
      const boss = run.boss;
      boss.phase = 2;
      addTrauma(11);
      audio.playBossHorn();
      addFloatingText(boss.x, boss.y - 68, '枯棘古樹王狂暴化！', PALETTE.crimson, 20);
      run.shockwaves.push({
        x: boss.x,
        y: boss.y,
        radius: 30,
        maxRadius: 240,
        color: PALETTE.crimson,
        life: 0.5,
        maxLife: 0.5,
      });
      spawnParticles(boss.x, boss.y, 26, PALETTE.blight, 100, 280, 3, 5.5);
    }
  }

  function updateEnemies(dt) {
    const p = run.player;
    for (let i = 0; i < run.enemies.length; i++) {
      const e = run.enemies[i];
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      // enemy_golem.png natively faces LEFT; enemy_imp.png faces slightly RIGHT
      e.facing = e.type === 'golem' ? (dx >= 0 ? -1 : 1) : (dx >= 0 ? 1 : -1);

      // 0.65s Purple Blight summoning telegraph before materializing
      if (e.spawnTimer > 0) {
        e.spawnTimer = Math.max(0, e.spawnTimer - dt);
        if (e.spawnTimer <= 0) {
          e.spawnPop = 0.18;
          spawnParticles(e.x, e.y, 9, PALETTE.blight, 55, 165, 2, 4);
        }
        continue;
      }

      if (e.spawnPop > 0) e.spawnPop = Math.max(0, e.spawnPop - dt);
      if (e.flashTimer > 0) e.flashTimer = Math.max(0, e.flashTimer - dt);

      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      if (e.type === 'imp') {
        const weave = Math.sin(worldTime * 6.5 + e.seed) * 0.42;
        const perpX = -ny;
        const perpY = nx;
        e.vx = (nx + perpX * weave) * e.speed;
        e.vy = (ny + perpY * weave) * e.speed;
      } else if (e.type === 'wisp') {
        if (e.chargeTimer > 0) {
          // Charging telegraph (0.55s)
          e.chargeTimer -= dt;
          e.vx *= 0.85;
          e.vy *= 0.85;
          if (e.chargeTimer <= 0) {
            const aim = Math.atan2(p.y - e.y, p.x - e.x);
            const spd = 270;
            if (run.enemyBullets.length >= CAPS.maxEnemyBullets) run.enemyBullets.shift();
            run.enemyBullets.push({
              x: e.x + Math.cos(aim) * 18,
              y: e.y + Math.sin(aim) * 18,
              vx: Math.cos(aim) * spd,
              vy: Math.sin(aim) * spd,
              damage: 16,
              radius: 9,
              drawSize: 26,
              spin: 0,
              life: 3.4,
            });
            spawnParticles(e.x, e.y, 6, PALETTE.blight, 60, 140, 2, 3.5, aim, 0.8);
          }
        } else {
          if (dist < 250) {
            e.vx = -nx * e.speed;
            e.vy = -ny * e.speed;
          } else if (dist > 350) {
            e.vx = nx * e.speed;
            e.vy = ny * e.speed;
          } else {
            e.vx = -ny * e.strafeDir * e.speed * 0.72;
            e.vy = nx * e.strafeDir * e.speed * 0.72;
          }

          e.attackTimer -= dt;
          if (e.attackTimer <= 0 && dist < 520) {
            e.attackTimer = 2.4;
            e.chargeTimer = 0.55;
          }
        }

        if (Math.random() < 0.14) {
          spawnParticles(e.x, e.y + 8, 1, PALETTE.blight, 10, 30, 1.5, 2.8);
        }
      } else if (e.type === 'golem') {
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;
      }

      // Soft separation between enemies
      for (let j = i + 1; j < run.enemies.length; j++) {
        const o = run.enemies[j];
        if (o.spawnTimer > 0) continue;
        const sdx = e.x - o.x;
        const sdy = e.y - o.y;
        const sdist = Math.hypot(sdx, sdy);
        const minD = e.radius + o.radius;
        if (sdist > 0 && sdist < minD) {
          const push = (minD - sdist) * 2.4 * dt;
          const sx = sdx / sdist;
          const sy = sdy / sdist;
          e.x += sx * push;
          e.y += sy * push;
          o.x -= sx * push;
          o.y -= sy * push;
        }
      }

      // Apply velocity & decaying knockback
      e.x += (e.vx + e.kbVx) * dt;
      e.y += (e.vy + e.kbVy) * dt;
      e.kbVx *= Math.exp(-9 * dt);
      e.kbVy *= Math.exp(-9 * dt);

      // Keep enemies inside reachable clearing once entered so drops remain accessible
      if (!e.inGlade && isInsideGlade(e.x, e.y, 4, 4)) {
        e.inGlade = true;
      }
      if (e.inGlade) {
        const clampedEnemy = clampToGlade(e.x, e.y, 4, 4);
        e.x = clampedEnemy.x;
        e.y = clampedEnemy.y;
      }

      // Player contact collision
      if (Math.hypot(p.x - e.x, p.y - e.y) <= p.radius + e.radius) {
        damagePlayer(e.contactDamage, e.x, e.y);
      }
    }
  }

  function updateBoss(dt) {
    const boss = run.boss;
    const p = run.player;
    if (boss.flashTimer > 0) boss.flashTimer = Math.max(0, boss.flashTimer - dt);

    const p2 = boss.phase === 2;
    const cdScale = p2 ? 0.75 : 1.0;

    // Phase 2 Blight Summon every 9s
    if (p2) {
      boss.summonTimer -= dt;
      if (boss.summonTimer <= 0) {
        boss.summonTimer = 9.0;
        addFloatingText(boss.x, boss.y - 68, '腐化召喚！', PALETTE.blight, 17);
        const summonSpots = [
          clampToGlade(boss.x - 120, boss.y + 50, 24, 24),
          clampToGlade(boss.x + 120, boss.y + 50, 24, 24),
          clampToGlade(boss.x, boss.y + 110, 24, 24),
          clampToGlade(boss.x + (Math.random() < 0.5 ? -160 : 160), boss.y - 40, 24, 24),
        ];
        ['imp', 'imp', 'imp', 'wisp'].forEach((type, idx) => {
          const spot = summonSpots[idx];
          spawnEnemy(type, spot);
          run.shockwaves.push({
            x: spot.x,
            y: spot.y,
            radius: 10,
            maxRadius: 56,
            color: PALETTE.blight,
            life: 0.35,
            maxLife: 0.35,
          });
        });
      }
    }

    if (boss.state === 'approach') {
      const dx = p.x - boss.x;
      const dy = p.y - boss.y;
      const dist = Math.hypot(dx, dy) || 1;
      boss.facing = dx >= 0 ? 1 : -1;
      const spd = p2 ? 92 : 74;
      const nextBoss = clampToGlade(boss.x + (dx / dist) * spd * dt, boss.y + (dy / dist) * spd * dt, 35, 30);
      boss.x = nextBoss.x;
      boss.y = nextBoss.y;

      boss.stateTimer -= dt;
      if (boss.stateTimer <= 0) {
        if (boss.nextSkill === 'volley') {
          boss.state = 'volley_charge';
          boss.stateTimer = 0.65 * cdScale;
          boss.nextSkill = 'dash';
        } else {
          boss.state = 'dash_charge';
          boss.stateTimer = 0.75 * cdScale;
          boss.dashAngle = Math.atan2(p.y - boss.y, p.x - boss.x);
          boss.facing = Math.cos(boss.dashAngle) >= 0 ? 1 : -1;
          boss.nextSkill = 'volley';
        }
      }
    } else if (boss.state === 'volley_charge') {
      boss.stateTimer -= dt;
      if (boss.stateTimer <= 0) {
        boss.state = 'volley_fire';
        boss.volleyCount = 0;
        boss.volleySubTimer = 0;
      }
    } else if (boss.state === 'volley_fire') {
      boss.volleySubTimer -= dt;
      if (boss.volleySubTimer <= 0) {
        fireBossVolley(boss.volleyCount);
        boss.volleyCount += 1;
        if (boss.volleyCount >= 2) {
          boss.state = 'approach';
          boss.stateTimer = 2.3 * cdScale;
        } else {
          boss.volleySubTimer = 0.38 * cdScale;
        }
      }
    } else if (boss.state === 'dash_charge') {
      boss.stateTimer -= dt;
      if (boss.stateTimer <= 0) {
        boss.state = 'dashing';
        boss.stateTimer = 0.56;
        audio.playBurst();
      }
    } else if (boss.state === 'dashing') {
      boss.stateTimer -= dt;
      const dashSpeed = p2 ? 680 : 620;
      const nextX = boss.x + Math.cos(boss.dashAngle) * dashSpeed * dt;
      const nextY = boss.y + Math.sin(boss.dashAngle) * dashSpeed * dt;
      const clampedDash = clampToGlade(nextX, nextY, 35, 30);

      const hitWall = Math.hypot(clampedDash.x - nextX, clampedDash.y - nextY) > 0.5;

      boss.x = clampedDash.x;
      boss.y = clampedDash.y;

      if (Math.random() < 0.7) {
        spawnParticles(boss.x, boss.y + 30, 2, PALETTE.blight, 40, 140, 3, 5);
      }

      if (hitWall || boss.stateTimer <= 0) {
        if (hitWall) {
          addTrauma(11);
          audio.playKill(true);
          spawnParticles(boss.x, boss.y, 16, PALETTE.gold, 80, 220, 2.5, 4.5);
        }
        boss.state = 'approach';
        boss.stateTimer = 2.0 * cdScale;
      }
    }

    // Contact collision with player
    if (Math.hypot(p.x - boss.x, p.y - boss.y) <= p.radius + boss.radius) {
      damagePlayer(boss.contactDamage, boss.x, boss.y);
    }
  }

  function fireBossVolley(roundIndex) {
    const boss = run.boss;
    const p2 = boss.phase === 2;
    const ways = p2 ? 14 : 10;
    const baseOffset = roundIndex * (Math.PI / ways);
    const spd = p2 ? 275 : 250;

    for (let i = 0; i < ways; i++) {
      const ang = (i / ways) * Math.PI * 2 + baseOffset;
      if (run.enemyBullets.length >= CAPS.maxEnemyBullets) run.enemyBullets.shift();
      run.enemyBullets.push({
        x: boss.x + Math.cos(ang) * 42,
        y: boss.y + Math.sin(ang) * 42,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        damage: 18,
        radius: 10,
        drawSize: 28,
        spin: Math.random() * Math.PI * 2,
        life: 4.5,
      });
    }

    if (p2) {
      const innerSpd = 210;
      for (let i = 0; i < ways; i++) {
        const ang = (i / ways) * Math.PI * 2 + baseOffset + Math.PI / ways;
        if (run.enemyBullets.length >= CAPS.maxEnemyBullets) run.enemyBullets.shift();
        run.enemyBullets.push({
          x: boss.x + Math.cos(ang) * 34,
          y: boss.y + Math.sin(ang) * 34,
          vx: Math.cos(ang) * innerSpd,
          vy: Math.sin(ang) * innerSpd,
          damage: 16,
          radius: 9,
          drawSize: 25,
          spin: Math.random() * Math.PI * 2,
          life: 4.8,
        });
      }
    }

    spawnParticles(boss.x, boss.y, 14, PALETTE.blight, 90, 210, 2.5, 4.5);
  }

  function updateEnemyBullets(dt) {
    const p = run.player;
    for (let i = run.enemyBullets.length - 1; i >= 0; i--) {
      const b = run.enemyBullets[i];
      b.life -= dt;
      b.spin += 6.8 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.life <= 0 || b.x < 40 || b.x > WORLD_W - 40 || b.y < 140 || b.y > WORLD_H - 20) {
        run.enemyBullets.splice(i, 1);
        continue;
      }

      if (Math.hypot(p.x - b.x, p.y - b.y) <= p.radius + b.radius) {
        if (p.invulnTimer <= 0 && p.graceTimer <= 0) {
          damagePlayer(b.damage, b.x, b.y);
          run.enemyBullets.splice(i, 1);
        }
      }
    }
  }

  function updatePickups(dt) {
    const p = run.player;
    for (let i = run.pickups.length - 1; i >= 0; i--) {
      const item = run.pickups[i];
      item.life -= dt;
      if (item.life <= 0) {
        run.pickups.splice(i, 1);
        continue;
      }

      const clampedPickup = clampToGlade(item.x + item.vx * dt, item.y + item.vy * dt, 16, 16);
      item.x = clampedPickup.x;
      item.y = clampedPickup.y;
      item.vx *= Math.exp(-7 * dt);
      item.vy *= Math.exp(-7 * dt);

      const dx = p.x - item.x;
      const dy = p.y - item.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (dist <= p.magnetRadius) {
        const pullSpeed = 480 + (1 - dist / p.magnetRadius) * 260;
        item.x += (dx / dist) * pullSpeed * dt;
        item.y += (dy / dist) * pullSpeed * dt;
      }

      if (dist <= p.radius + 18) {
        applyPickup(item);
        run.pickups.splice(i, 1);
      }
    }
  }

  function updateVisualEffects(dt) {
    for (let i = run.particles.length - 1; i >= 0; i--) {
      const pt = run.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.exp(-4 * dt);
      pt.vy *= Math.exp(-4 * dt);
      if (pt.life <= 0) run.particles.splice(i, 1);
    }

    for (let i = run.afterimages.length - 1; i >= 0; i--) {
      const af = run.afterimages[i];
      af.life -= dt;
      if (af.life <= 0) run.afterimages.splice(i, 1);
    }

    for (let i = run.shockwaves.length - 1; i >= 0; i--) {
      const sw = run.shockwaves[i];
      sw.life -= dt;
      if (sw.life <= 0) run.shockwaves.splice(i, 1);
    }

    for (let i = run.floatingTexts.length - 1; i >= 0; i--) {
      const ft = run.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      ft.vy *= Math.exp(-3 * dt);
      if (ft.life <= 0) run.floatingTexts.splice(i, 1);
    }
  }

  function updateFireflies(dt) {
    for (const f of fireflies) {
      f.phase += dt * 2.2;
      f.x += f.vx * dt + Math.sin(f.phase * 0.7) * 6 * dt;
      f.y += f.vy * dt + Math.cos(f.phase * 0.6) * 5 * dt;
      if (f.x < GLADE.minX - 40) f.x = GLADE.maxX + 30;
      if (f.x > GLADE.maxX + 40) f.x = GLADE.minX - 30;
      if (f.y < GLADE.minY - 70) f.y = GLADE.maxY + 25;
      if (f.y > GLADE.maxY + 35) f.y = GLADE.minY - 60;
    }
  }

  // =========================================================================
  // Canvas Rendering
  // =========================================================================
  function drawSpriteWithFlash(img, x, y, drawW, drawH, facing = 1, rot = 0, flash = false, alpha = 1, squash = 0) {
    if (!isImgReady(img)) return;
    ctx.save();
    ctx.translate(x, y);
    if (rot !== 0) ctx.rotate(rot);
    const sx = facing * (1 + squash * 0.35);
    const sy = 1 - squash * 0.25;
    ctx.scale(sx, sy);
    ctx.globalAlpha = alpha;

    if (flash) {
      const w = Math.min(256, img.width);
      const h = Math.min(256, img.height);
      flashCtx.clearRect(0, 0, w, h);
      flashCtx.drawImage(img, 0, 0, w, h);
      flashCtx.globalCompositeOperation = 'source-atop';
      flashCtx.fillStyle = '#FFFFFF';
      flashCtx.fillRect(0, 0, w, h);
      flashCtx.globalCompositeOperation = 'source-over';
      ctx.drawImage(flashCanvas, 0, 0, w, h, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
    } else {
      ctx.drawImage(img, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
    }
    ctx.restore();
  }

  function drawGroundShadow(x, y, rx, ry) {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 16, 21, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    const cx = Math.round(camera.x + camera.shakeX);
    const cy = Math.round(camera.y + camera.shakeY);
    ctx.translate(-cx, -cy);

    // 1. Arena background (bg_glade.png at 1600x1000)
    if (isImgReady(images.bg_glade)) {
      ctx.drawImage(images.bg_glade, 0, 0, WORLD_W, WORLD_H);
    } else {
      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }

    // 2. Pulsing central rune circle aura (aligned 1:1 to bg_glade.png rune stone circle)
    ctx.save();
    ctx.translate(ALTAR.x, ALTAR.y);
    ctx.scale(1, ALTAR.ry / ALTAR.rx);
    const runePulse = 0.09 + 0.05 * Math.sin(worldTime * 1.8);
    const grad = ctx.createRadialGradient(0, 0, 18, 0, 0, ALTAR.rx * 1.25);
    grad.addColorStop(0, `rgba(56, 232, 198, ${runePulse})`);
    grad.addColorStop(0.65, `rgba(56, 232, 198, ${runePulse * 0.45})`);
    grad.addColorStop(1, 'rgba(56, 232, 198, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, ALTAR.rx * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2b. Active Central Runic Altar Surge floor aura & radial charge arc
    if (run && run.altar.active) {
      drawAltarFloor(run.altar);
    }

    // 3. Faint boundary shimmer when player nears glade wall
    if (run && gameState !== 'TITLE') {
      drawGladeBoundaryCues(run.player);
    }

    // 4. Boss Root Dash ground strip telegraph (drawn on floor)
    if (run && run.boss && run.boss.state === 'dash_charge') {
      drawBossDashTelegraph(run.boss);
    }

    // 5. Shockwaves on floor
    if (run) {
      for (const sw of run.shockwaves) {
        const progress = 1 - sw.life / sw.maxLife;
        const r = lerp(sw.radius, sw.maxRadius, progress);
        ctx.save();
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = (1 - progress) * 0.72;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. Pickups
    if (run) {
      for (const item of run.pickups) {
        if (item.life < 4 && Math.floor(item.life * 8) % 2 === 0) continue;
        const bob = Math.sin(worldTime * 4.4 + item.seed) * 4;
        const spriteMap = {
          mana: { img: images.pickup_mana, size: 26, glow: PALETTE.cyan },
          tome: { img: images.pickup_tome, size: 30, glow: PALETTE.gold },
          sigil: { img: images.pickup_sigil, size: 30, glow: PALETTE.blight },
          shield: { img: images.pickup_shield, size: 30, glow: PALETTE.cyan },
          herb: { img: images.pickup_herb, size: 28, glow: PALETTE.heal },
        };
        const cfg = spriteMap[item.type];
        drawGroundShadow(item.x, item.y + 12, 11, 4.5);

        ctx.save();
        const g = ctx.createRadialGradient(item.x, item.y + bob, 2, item.x, item.y + bob, 22);
        g.addColorStop(0, cfg.glow);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(item.x, item.y + bob, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        drawSpriteWithFlash(cfg.img, item.x, item.y + bob, cfg.size, cfg.size, 1, 0, false, 1, 0);
      }
    }

    // 7. Blink Afterimages
    if (run) {
      for (const af of run.afterimages) {
        const a = (af.life / af.maxLife) * 0.52;
        ctx.save();
        ctx.globalAlpha = a * 0.7;
        const g = ctx.createRadialGradient(af.x, af.y, 4, af.x, af.y, 30);
        g.addColorStop(0, PALETTE.cyan);
        g.addColorStop(0.55, PALETTE.gold);
        g.addColorStop(1, 'rgba(56, 232, 198, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(af.x, af.y, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        drawSpriteWithFlash(images.player_warden, af.x, af.y, 64, 64, af.facing, 0, false, a, 0);
      }
    }

    // 8. Y-sorted Characters (Player, Enemies, Boss)
    if (run) {
      const renderables = [];
      renderables.push({ kind: 'player', y: run.player.y, obj: run.player });
      for (const e of run.enemies) renderables.push({ kind: 'enemy', y: e.y, obj: e });
      if (run.boss) renderables.push({ kind: 'boss', y: run.boss.y, obj: run.boss });
      renderables.sort((a, b) => a.y - b.y);

      for (const item of renderables) {
        if (item.kind === 'player') drawPlayer(item.obj);
        else if (item.kind === 'enemy') drawEnemy(item.obj);
        else drawBoss(item.obj);
      }
    }

    // 9. Projectiles
    if (run) {
      for (const b of run.playerBullets) {
        const angle = Math.atan2(b.vy, b.vx) + Math.PI / 4;
        drawSpriteWithFlash(images.proj_ember, b.x, b.y, b.drawSize, b.drawSize, 1, angle, false, 1, 0);
      }
      for (const b of run.enemyBullets) {
        drawSpriteWithFlash(images.proj_blight, b.x, b.y, b.drawSize, b.drawSize, 1, b.spin, false, 1, 0);
      }
    }

    // 10. Particles & Fireflies
    if (run) {
      for (const pt of run.particles) {
        ctx.save();
        ctx.globalAlpha = pt.life / pt.maxLife;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    for (const f of fireflies) {
      const alpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(f.phase * 1.4));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.gold ? PALETTE.gold : PALETTE.cyan;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 11. Floating Combat / Score Numbers
    if (run) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const ft of run.floatingTexts) {
        const alpha = clamp(ft.life / (ft.maxLife * 0.45), 0, 1);
        ctx.globalAlpha = alpha;
        ctx.font = `800 ${ft.size}px "Noto Sans TC", sans-serif`;
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = PALETTE.ink;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.restore();
    }

    // 12. Custom Arcane Reticle during active play
    if (run && gameState === 'PLAYING') {
      drawReticle(mouse.worldX, mouse.worldY);
    }

    ctx.restore();
  }

  function drawGladeBoundaryCues(p) {
    const prox = getGladeBoundaryProximity(p.x, p.y, 40);
    if (prox <= 0.01) return;

    const footX = p.x;
    const footY = p.y + 24;

    ctx.save();
    // Soft radial floor-plane mist strictly beneath the player's feet
    ctx.save();
    ctx.translate(footX, footY);
    ctx.scale(1, 0.42);
    const mistGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
    mistGrad.addColorStop(0, `rgba(56, 232, 198, ${prox * 0.26})`);
    mistGrad.addColorStop(0.55, `rgba(56, 232, 198, ${prox * 0.11})`);
    mistGrad.addColorStop(1, 'rgba(56, 232, 198, 0)');
    ctx.fillStyle = mistGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Elliptical floor-plane rune ring strictly beneath the feet
    ctx.strokeStyle = `rgba(56, 232, 198, ${prox * 0.42})`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 5]);
    ctx.lineDashOffset = -worldTime * 18;
    ctx.beginPath();
    ctx.ellipse(footX, footY, 26 + prox * 4, 10 + prox * 1.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawAltarFloor(altar) {
    const pulse = 0.5 + 0.5 * Math.sin(worldTime * 5.2);
    const fadeOut = altar.activeTimer < 2.2 ? 0.5 + 0.5 * Math.sin(worldTime * 16) : 1;
    const aspect = ALTAR.ry / ALTAR.rx;
    const R = ALTAR.rx;

    ctx.save();
    ctx.translate(ALTAR.x, ALTAR.y);
    ctx.scale(1, aspect);

    // Warm #FFB347 + #38E8C6 pulsing floor-plane aura
    const aura = ctx.createRadialGradient(0, 0, R * 0.15, 0, 0, R * 1.15);
    const innerAlpha = (altar.inside ? 0.3 : 0.19) + pulse * 0.08;
    aura.addColorStop(0, `rgba(255, 179, 71, ${innerAlpha * fadeOut})`);
    aura.addColorStop(0.62, `rgba(56, 232, 198, ${(0.14 + pulse * 0.07) * fadeOut})`);
    aura.addColorStop(1, 'rgba(56, 232, 198, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // Rotating golden outer rune ring
    ctx.save();
    ctx.rotate(worldTime * 0.45);
    ctx.strokeStyle = altar.inside ? PALETTE.gold : `rgba(255, 179, 71, ${(0.65 + pulse * 0.25) * fadeOut})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, R - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Counter-rotating cyan inner rune ring
    ctx.save();
    ctx.rotate(-worldTime * 0.7);
    ctx.strokeStyle = `rgba(56, 232, 198, ${(0.55 + pulse * 0.3) * fadeOut})`;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Crisp circular radial progress arc around the rune circle
    const arcR = R + 9;
    ctx.strokeStyle = 'rgba(255, 179, 71, 0.2)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, arcR, 0, Math.PI * 2);
    ctx.stroke();

    if (altar.charge > 0.005) {
      ctx.strokeStyle = altar.inside ? PALETTE.gold : PALETTE.cyan;
      ctx.lineWidth = 6.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, arcR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * altar.charge);
      ctx.stroke();

      // Inner bright core arc
      ctx.strokeStyle = PALETTE.text;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, arcR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * altar.charge);
      ctx.stroke();
    }

    ctx.restore();

    // Subtle floating floor ring cues (screen-crisp text outside scale)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = PALETTE.ink;

    ctx.font = '800 13px "Noto Sans TC", sans-serif';
    ctx.globalAlpha = 0.88 * fadeOut;
    const topText = `星火祭壇啟動 · ${Math.ceil(altar.activeTimer)}s`;
    ctx.strokeText(topText, ALTAR.x, ALTAR.y - ALTAR.ry - 16);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(topText, ALTAR.x, ALTAR.y - ALTAR.ry - 16);

    const cueText = altar.inside
      ? `充能中 ${Math.round(altar.charge * 100)}%`
      : '站在陣中充能';
    ctx.font = '700 12.5px "Noto Sans TC", sans-serif';
    ctx.globalAlpha = (altar.inside ? 0.96 : 0.72 + pulse * 0.24) * fadeOut;
    ctx.strokeText(cueText, ALTAR.x, ALTAR.y + ALTAR.ry + 18);
    ctx.fillStyle = altar.inside ? PALETTE.gold : PALETTE.cyan;
    ctx.fillText(cueText, ALTAR.x, ALTAR.y + ALTAR.ry + 18);
    ctx.restore();
  }

  function drawPlayer(p) {
    const bob = p.walkPhase > 0 ? Math.abs(Math.sin(p.walkPhase)) * -3.5 : Math.sin(worldTime * 3) * 1.4;
    drawGroundShadow(p.x, p.y + 24, 20, 7.5);

    // Shield orbiting rune ring
    if (p.shields > 0) {
      ctx.save();
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = p.shields >= 2 ? 2.5 : 1.6;
      ctx.globalAlpha = 0.65 + 0.2 * Math.sin(worldTime * 5);
      ctx.setLineDash([8, 5]);
      ctx.lineDashOffset = -worldTime * 28;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 33, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Hurt invuln blink alpha
    let alpha = 1;
    if (p.invulnTimer > 0 && p.blinkTimer <= 0) {
      alpha = Math.floor(p.invulnTimer * 18) % 2 === 0 ? 0.45 : 1;
    }

    drawSpriteWithFlash(images.player_warden, p.x, p.y + bob, 64, 64, p.facing, 0, false, alpha, p.squash);
  }

  function drawEnemySpawnTelegraph(e) {
    const dur = e.spawnDuration || 0.65;
    const t = 1 - clamp(e.spawnTimer / dur, 0, 1);
    const ringR = e.radius * 1.45 + 5;

    ctx.save();
    ctx.translate(e.x, e.y);

    // Floor blight glow
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, ringR * 1.35);
    glow.addColorStop(0, `rgba(168, 85, 247, ${0.22 + 0.25 * t})`);
    glow.addColorStop(0.65, `rgba(168, 85, 247, ${0.14 * t})`);
    glow.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, ringR * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // Outer rotating #A855F7 blight rune ring + rune ticks
    ctx.save();
    ctx.rotate(worldTime * 3.8 + e.seed);
    ctx.strokeStyle = PALETTE.blight;
    ctx.globalAlpha = 0.55 + 0.4 * t;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();

    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (ringR - 4), Math.sin(a) * (ringR - 4));
      ctx.lineTo(Math.cos(a) * (ringR + 4), Math.sin(a) * (ringR + 4));
      ctx.stroke();
    }
    ctx.restore();

    // Inner counter-rotating dashed rune ring
    ctx.save();
    ctx.rotate(-worldTime * 5.2 + e.seed);
    ctx.strokeStyle = '#C084FC';
    ctx.globalAlpha = 0.5 + 0.45 * t;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, ringR * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Scaling inner summoning circle
    ctx.fillStyle = `rgba(168, 85, 247, ${0.2 + 0.35 * t})`;
    ctx.strokeStyle = PALETTE.text;
    ctx.globalAlpha = 0.4 + 0.55 * t;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, ringR * 0.65 * t), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function drawEnemy(e) {
    if (e.spawnTimer > 0) {
      drawEnemySpawnTelegraph(e);
      return;
    }

    let bob = 0;
    let sway = 0;
    if (e.type === 'imp') {
      bob = Math.sin(worldTime * 8 + e.seed) * 4;
    } else if (e.type === 'wisp') {
      bob = Math.sin(worldTime * 3.6 + e.seed) * 5;
    } else if (e.type === 'golem') {
      bob = Math.abs(Math.sin(worldTime * 5 + e.seed)) * -2.5;
      sway = Math.sin(worldTime * 5 + e.seed) * 0.045;
    }

    drawGroundShadow(e.x, e.y + e.drawSize * 0.36, e.drawSize * 0.31, e.drawSize * 0.11);

    // Wisp 0.55s violet charge ring telegraph behind sprite
    if (e.type === 'wisp' && e.chargeTimer > 0) {
      const t = 1 - e.chargeTimer / 0.55;
      ctx.save();
      ctx.strokeStyle = PALETTE.blight;
      ctx.lineWidth = 2.6;
      ctx.globalAlpha = 0.4 + 0.55 * t;
      ctx.beginPath();
      ctx.arc(e.x, e.y + bob, lerp(34, 16, t), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const popSquash = e.spawnPop > 0 ? (e.spawnPop / 0.18) * 0.24 : 0;

    drawSpriteWithFlash(
      images[e.spriteKey],
      e.x,
      e.y + bob,
      e.drawSize,
      e.drawSize,
      e.facing,
      sway,
      e.flashTimer > 0,
      1,
      popSquash
    );

    // Crisp micro HP bar if damaged
    if (e.hp < e.maxHp) {
      const bw = e.type === 'golem' ? 46 : 30;
      const bx = e.x - bw * 0.5;
      const by = e.y - e.drawSize * 0.52 - 6;
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
      ctx.fillStyle = PALETTE.crimson;
      ctx.fillRect(bx, by, bw * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
  }

  function drawBossDashTelegraph(boss) {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(boss.dashAngle);
    const len = 430;
    const width = 76;
    const pulse = 0.25 + 0.2 * Math.sin(worldTime * 18);

    ctx.fillStyle = `rgba(168, 85, 247, ${pulse})`;
    ctx.fillRect(0, -width * 0.5, len, width);

    ctx.strokeStyle = PALETTE.crimson;
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(0, -width * 0.5, len, width);
    ctx.restore();
  }

  function drawBoss(boss) {
    const breath = Math.sin(worldTime * 2.4) * 2.5;
    drawGroundShadow(boss.x, boss.y + 56, 54, 19);

    // Phase 2 pulsing violet/crimson aura
    if (boss.phase === 2) {
      ctx.save();
      const pulse = 0.22 + 0.16 * Math.sin(worldTime * 7);
      const g = ctx.createRadialGradient(boss.x, boss.y, 24, boss.x, boss.y, 96);
      g.addColorStop(0, `rgba(239, 68, 68, ${pulse})`);
      g.addColorStop(0.65, `rgba(168, 85, 247, ${pulse * 0.8})`);
      g.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, 96, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Radial Volley expanding rune warning ring
    if (boss.state === 'volley_charge') {
      const maxCd = boss.phase === 2 ? 0.65 * 0.75 : 0.65;
      const t = 1 - clamp(boss.stateTimer / maxCd, 0, 1);
      ctx.save();
      ctx.strokeStyle = PALETTE.blight;
      ctx.lineWidth = 3.5;
      ctx.globalAlpha = 0.45 + 0.5 * t;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, lerp(48, 108, t), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawSpriteWithFlash(
      images.boss_thornwood,
      boss.x,
      boss.y + breath,
      boss.drawSize,
      boss.drawSize,
      boss.facing,
      0,
      boss.flashTimer > 0,
      1,
      0
    );
  }

  function drawReticle(x, y) {
    const p = run.player;
    const rechargeTime = p.burstBaseCd * p.burstCdMult;
    const chargeProgress = p.burstCharges >= p.burstMaxCharges ? 1 : p.burstRecharge / rechargeTime;

    ctx.save();
    ctx.translate(x, y);

    // Outer Ember Burst ring
    ctx.strokeStyle = 'rgba(244, 239, 230, 0.24)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = p.burstCharges > 0 ? PALETTE.gold : PALETTE.cyan;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, 15, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * chargeProgress);
    ctx.stroke();

    // Inner cross ticks
    ctx.strokeStyle = PALETTE.text;
    ctx.lineWidth = 1.6;
    [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].forEach((a) => {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
      ctx.stroke();
    });

    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // =========================================================================
  // HUD Sync
  // =========================================================================
  function syncHud() {
    if (!run) return;
    const p = run.player;

    // HP
    const hpPct = clamp((p.hp / p.maxHp) * 100, 0, 100);
    ui.hpBar.style.width = `${hpPct}%`;
    ui.hpBar.classList.toggle('critical', hpPct <= 30);
    ui.hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;

    // Arcane Blink
    const blinkTotal = p.blinkBaseCd * p.blinkCdMult;
    const blinkReadyPct = p.blinkCooldown <= 0 ? 100 : clamp((1 - p.blinkCooldown / blinkTotal) * 100, 0, 100);
    ui.blinkBar.style.width = `${blinkReadyPct}%`;
    if (p.blinkCooldown <= 0) {
      ui.blinkStatus.textContent = '就緒';
      ui.blinkStatus.className = 'hud-tag ready';
    } else {
      ui.blinkStatus.textContent = `${p.blinkCooldown.toFixed(1)}s`;
      ui.blinkStatus.className = 'hud-tag cooling';
    }

    // Ember Burst 2 charges
    const burstTotal = p.burstBaseCd * p.burstCdMult;
    ui.burstCount.textContent = `${p.burstCharges} / ${p.burstMaxCharges}`;
    const pips = [ui.burstPip0, ui.burstPip1];
    pips.forEach((pip, idx) => {
      if (idx < p.burstCharges) {
        pip.style.width = '100%';
      } else if (idx === p.burstCharges) {
        pip.style.width = `${clamp((p.burstRecharge / burstTotal) * 100, 0, 100)}%`;
      } else {
        pip.style.width = '0%';
      }
    });

    // Shield pips
    ui.shieldPip0.classList.toggle('active', p.shields >= 1);
    ui.shieldPip1.classList.toggle('active', p.shields >= 2);

    // Active temporary buff badges
    let buffHtml = '';
    if (p.tomeTimer > 0) {
      buffHtml += `<div class="buff-chip"><img src="assets/pickup_tome.png" alt="星火秘典" /><span>星火秘典 ${p.tomeTimer.toFixed(1)}s</span></div>`;
    }
    if (p.sigilTimer > 0) {
      buffHtml += `<div class="buff-chip cyan"><img src="assets/pickup_sigil.png" alt="三重符印" /><span>三重符印 ${p.sigilTimer.toFixed(1)}s</span></div>`;
    }
    if (ui.buffBadges.innerHTML !== buffHtml) {
      ui.buffBadges.innerHTML = buffHtml;
    }

    // Center wave & Boss HUD
    ui.waveNum.textContent = String(run.wave);
    const remain = run.waveQueue.length + run.enemies.length + (run.boss ? 1 : 0);
    ui.enemiesLeft.textContent = String(remain);

    if (run.boss) {
      ui.bossHud.classList.remove('hidden');
      ui.bossHpText.textContent = `${Math.max(0, Math.ceil(run.boss.hp))} / ${run.boss.maxHp}`;
      ui.bossHpBar.style.width = `${clamp((run.boss.hp / run.boss.maxHp) * 100, 0, 100)}%`;
      if (run.boss.phase === 2) {
        ui.bossPhaseTag.textContent = '狂暴階段';
        ui.bossPhaseTag.classList.add('enraged');
      } else {
        ui.bossPhaseTag.textContent = '第一階段';
        ui.bossPhaseTag.classList.remove('enraged');
      }
    } else {
      ui.bossHud.classList.add('hidden');
    }

    // Score & Combo
    ui.scoreNum.textContent = run.score.toLocaleString('en-US');
    ui.bestNum.textContent = Math.max(records.highScore, run.score).toLocaleString('en-US');

    if (run.combo > 0) {
      ui.comboBox.classList.remove('hidden');
      ui.comboCount.textContent = `${run.combo} 連擊`;
      ui.comboMult.textContent = `x${getComboMultiplier(run.combo).toFixed(1)}`;
      ui.comboBar.style.width = `${clamp((run.comboTimer / 3.5) * 100, 0, 100)}%`;
    } else {
      ui.comboBox.classList.add('hidden');
    }

    // XP Bar
    ui.levelBadge.textContent = `LV. ${run.level}`;
    ui.xpBar.style.width = `${clamp((run.xp / run.nextXp) * 100, 0, 100)}%`;
    ui.xpText.textContent = `${run.xp} / ${run.nextXp}`;
  }

  function refreshTitleRecords() {
    ui.startBestScore.textContent = records.highScore.toLocaleString('en-US');
    ui.startBestWave.textContent = `第 ${records.bestWave} 波`;
  }

  function syncSettingToggles() {
    ui.autocastState.textContent = autoCastEnabled ? '開啟' : '關閉';
    ui.autocastState.className = autoCastEnabled ? 'state-on' : 'state-off';

    ui.pauseMuteState.textContent = audio.muted ? '靜音' : '開啟';
    ui.pauseMuteState.className = audio.muted ? 'state-off' : 'state-on';
    ui.muteBtn.classList.toggle('is-muted', audio.muted);
    ui.muteBtn.setAttribute('aria-pressed', String(audio.muted));
  }

  function syncBlessingsUI() {
    if (!run) return;
    const acquired = BLESSINGS.filter((b) => (run.blessingCounts[b.id] || 0) > 0);

    // Compact HUD strip below top-left card/buffs
    if (acquired.length === 0) {
      ui.hudBlessings.classList.add('hidden');
      ui.hudBlessings.innerHTML = '';
    } else {
      ui.hudBlessings.classList.remove('hidden');
      ui.hudBlessings.innerHTML = acquired
        .map((b) => {
          const lv = run.blessingCounts[b.id];
          return `<div class="hud-blessing-chip" title="${b.name} Lv.${lv}"><img src="${b.icon}" alt="${b.name}" /><span class="hud-blessing-lv">Lv.${lv}</span></div>`;
        })
        .join('');
    }

    // Pause Modal Awakened Blessings grid
    ui.pauseBlessingsCount.textContent = `${acquired.length} 項`;
    if (acquired.length === 0) {
      ui.pauseBlessingsGrid.innerHTML = '<div class="pause-blessing-empty">尚未覺醒符文祝福</div>';
    } else {
      ui.pauseBlessingsGrid.innerHTML = acquired
        .map((b) => {
          const lv = run.blessingCounts[b.id];
          return `<div class="pause-blessing-item"><div class="pause-blessing-left"><img src="${b.icon}" alt="${b.name}" /><span class="pause-blessing-name">${b.name}</span></div><span class="pause-blessing-lv">Lv.${lv}</span></div>`;
        })
        .join('');
    }
  }

  // =========================================================================
  // Game Flow Transitions
  // =========================================================================
  function startNewGame() {
    audio.unlock();
    run = createInitialRun();
    camera.x = clamp(run.player.x - VIEW_W * 0.5, 0, WORLD_W - VIEW_W);
    camera.y = clamp(run.player.y - VIEW_H * 0.5, 0, WORLD_H - VIEW_H);
    camera.trauma = 0;
    hitStopTimer = 0;
    slowMoTimer = 0;

    ui.titleScreen.classList.add('hidden');
    ui.pauseScreen.classList.add('hidden');
    ui.levelupScreen.classList.add('hidden');
    ui.endScreen.classList.add('hidden');
    ui.hud.classList.remove('hidden');

    gameState = 'PLAYING';
    canvas.classList.add('playing-reticle');
    syncSettingToggles();
    syncBlessingsUI();
    startWave(1);
    syncHud();
  }

  function togglePause() {
    if (!run) return;
    if (gameState === 'PLAYING') {
      gameState = 'PAUSED';
      keys.clear();
      mouse.leftDown = false;
      canvas.classList.remove('playing-reticle');
      syncSettingToggles();
      syncBlessingsUI();
      ui.pauseScreen.classList.remove('hidden');
    } else if (gameState === 'PAUSED') {
      gameState = 'PLAYING';
      ui.pauseScreen.classList.add('hidden');
      canvas.classList.add('playing-reticle');
    }
  }

  function returnToTitle() {
    gameState = 'TITLE';
    keys.clear();
    mouse.leftDown = false;
    canvas.classList.remove('playing-reticle');
    ui.hud.classList.add('hidden');
    ui.pauseScreen.classList.add('hidden');
    ui.levelupScreen.classList.add('hidden');
    ui.endScreen.classList.add('hidden');
    ui.waveBanner.classList.add('hidden');
    ui.titleScreen.classList.remove('hidden');
    refreshTitleRecords();
  }

  function triggerEndScreen(isVictory) {
    gameState = 'END';
    keys.clear();
    mouse.leftDown = false;
    canvas.classList.remove('playing-reticle');
    ui.waveBanner.classList.add('hidden');

    const beatRecord = saveRecords(run.score, run.wave);
    refreshTitleRecords();

    if (isVictory) {
      ui.endEyebrow.textContent = 'GLADE PURIFIED';
      ui.endEyebrow.className = 'eyebrow cyan';
      ui.endTitle.textContent = '林地淨化・勝利達成！';
      ui.endDesc.textContent = '枯棘古樹王已被星火淨化，月光林地重現平靜。你也可以選擇踏入無盡挑戰！';
      ui.endlessBtn.classList.remove('hidden');
      audio.playLevelUp();
    } else {
      ui.endEyebrow.textContent = 'GUARDIAN FALLEN';
      ui.endEyebrow.className = 'eyebrow danger';
      ui.endTitle.textContent = '星火熄滅・守護終止';
      ui.endDesc.textContent = '林地暫時陷入暗影，但你的星火印記已銘刻於古石之中。';
      ui.endlessBtn.classList.add('hidden');
    }

    ui.newRecordBadge.classList.toggle('hidden', !beatRecord);
    ui.endScore.textContent = run.score.toLocaleString('en-US');
    ui.endWave.textContent = `第 ${run.wave} 波`;
    ui.endKills.textContent = String(run.kills);
    ui.endCombo.textContent = `${run.maxCombo} 連擊`;
    ui.endLevel.textContent = `LV. ${run.level}`;

    ui.endScreen.classList.remove('hidden');
  }

  function continueEndlessMode() {
    if (!run) return;
    run.endlessMode = true;
    run.waveTransitionTimer = 0;
    run.bossSpawnPending = false;
    run.bossSpawnDelay = 0;
    run.waveQueue = [];
    keys.clear();
    mouse.leftDown = false;
    ui.endScreen.classList.add('hidden');
    gameState = 'PLAYING';
    canvas.classList.add('playing-reticle');
    run.player.graceTimer = 0.6;
    startWave(run.wave + 1);
    syncHud();
  }

  // =========================================================================
  // Input Listeners
  // =========================================================================
  function updateMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    mouse.viewX = clamp(((e.clientX - rect.left) / rect.width) * VIEW_W, 0, VIEW_W);
    mouse.viewY = clamp(((e.clientY - rect.top) / rect.height) * VIEW_H, 0, VIEW_H);
  }

  canvas.addEventListener('mousemove', updateMousePos);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('mousedown', (e) => {
    audio.unlock();
    updateMousePos(e);
    if (gameState !== 'PLAYING') return;

    if (e.button === 0) {
      mouse.leftDown = true;
      if (autoCastEnabled) {
        triggerEmberBurst();
      } else if (run.player.fireCooldown <= 0) {
        fireMainWeapon();
      }
    } else if (e.button === 2) {
      triggerArcaneBlink();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.leftDown = false;
  });

  window.addEventListener('keydown', (e) => {
    audio.unlock();

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === 'KeyM') {
      audio.setMuted(!audio.muted);
      syncSettingToggles();
      return;
    }

    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (gameState === 'PLAYING' || gameState === 'PAUSED') {
        togglePause();
      }
      return;
    }

    if (gameState === 'LEVEL_UP') {
      if (e.code === 'Digit1') chooseBlessing(0);
      else if (e.code === 'Digit2') chooseBlessing(1);
      else if (e.code === 'Digit3') chooseBlessing(2);
      return;
    }

    if (gameState === 'PLAYING') {
      keys.add(e.code);
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        triggerArcaneBlink();
      } else if (e.code === 'KeyE' || e.code === 'KeyF') {
        triggerEmberBurst();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  window.addEventListener('blur', () => {
    keys.clear();
    mouse.leftDown = false;
  });

  // UI Button Bindings
  ui.startBtn.addEventListener('click', startNewGame);
  ui.retryBtn.addEventListener('click', startNewGame);
  ui.endlessBtn.addEventListener('click', continueEndlessMode);
  ui.resumeBtn.addEventListener('click', togglePause);
  ui.restartPauseBtn.addEventListener('click', startNewGame);
  ui.homePauseBtn.addEventListener('click', returnToTitle);
  ui.homeEndBtn.addEventListener('click', returnToTitle);

  ui.pauseBtn.addEventListener('click', () => {
    audio.unlock();
    togglePause();
  });

  ui.muteBtn.addEventListener('click', () => {
    audio.unlock();
    audio.setMuted(!audio.muted);
    syncSettingToggles();
  });

  ui.pauseMuteToggle.addEventListener('click', () => {
    audio.unlock();
    audio.setMuted(!audio.muted);
    syncSettingToggles();
  });

  ui.autocastToggle.addEventListener('click', () => {
    autoCastEnabled = !autoCastEnabled;
    syncSettingToggles();
  });

  // =========================================================================
  // Main Animation Loop
  // =========================================================================
  let lastTimestamp = 0;

  function frame(timestamp) {
    const rawDt = Math.min(0.05, lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0.016);
    lastTimestamp = timestamp;

    worldTime += rawDt;
    updateFireflies(rawDt);

    if (bannerTimer > 0) {
      bannerTimer -= rawDt;
      if (bannerTimer <= 0) {
        ui.waveBanner.classList.add('hidden');
      }
    }

    if (gameState === 'PLAYING' && run) {
      updatePlaying(rawDt);
      syncHud();
    } else if (gameState === 'TITLE') {
      // Gentle ambient drift over the glade on Title Screen
      camera.x = (WORLD_W - VIEW_W) * 0.5 + Math.sin(worldTime * 0.16) * 55;
      camera.y = (WORLD_H - VIEW_H) * 0.5 + Math.cos(worldTime * 0.13) * 24;
    }

    render();
    requestAnimationFrame(frame);
  }

  // Initialize
  refreshTitleRecords();
  syncSettingToggles();
  preloadAssets().then(() => {
    requestAnimationFrame(frame);
  });
})();
