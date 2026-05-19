import React, { useState, useEffect, useRef } from 'react';
import { getSupabaseClient, getSupabaseCredentials } from './supabaseClient';

const DEFAULT_LAYOUT = {
  team_scores: {
    id: 'team_scores',
    name: 'Team Score',
    x: 80,
    y: 880,
    visible: true,
    fontSize: 32,
    fontColor: '#00ff88',
    fontFamily: 'Orbitron',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  active_batters: {
    id: 'active_batters',
    name: 'Active Batters',
    x: 520,
    y: 880,
    visible: true,
    fontSize: 22,
    fontColor: '#ffffff',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  current_bowler: {
    id: 'current_bowler',
    name: 'Current Bowler',
    x: 1080,
    y: 880,
    visible: true,
    fontSize: 22,
    fontColor: '#ffffff',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  timeline: {
    id: 'timeline',
    name: 'Over Timeline',
    x: 1480,
    y: 880,
    visible: true,
    fontSize: 18,
    fontColor: '#ffffff',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  partnership: {
    id: 'partnership',
    name: 'Active Partnership',
    x: 520,
    y: 800,
    visible: true,
    fontSize: 20,
    fontColor: '#fbbf24',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  target_badge: {
    id: 'target_badge',
    name: 'Target Info Badge',
    x: 80,
    y: 800,
    visible: true,
    fontSize: 20,
    fontColor: '#ef4444',
    fontFamily: 'Orbitron',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  run_rates: {
    id: 'run_rates',
    name: 'Run Rates (CRR/RRR)',
    x: 80,
    y: 720,
    visible: true,
    fontSize: 20,
    fontColor: '#38bdf8',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  extras_breakdown: {
    id: 'extras_breakdown',
    name: 'Extras Breakdown',
    x: 1480,
    y: 800,
    visible: true,
    fontSize: 18,
    fontColor: '#a78bfa',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  match_info: {
    id: 'match_info',
    name: 'Match Info Banner',
    x: 1080,
    y: 800,
    visible: true,
    fontSize: 18,
    fontColor: '#f3f4f6',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  }
};

const getPartnershipStats = (state) => {
  if (!state || !state.delivery_history) return { runs: 0, balls: 0 };
  
  const currentInnings = state.current_innings || 1;
  const deliveries = state.delivery_history.filter(b => b.innings === currentInnings);
  
  let lastWicketIndex = -1;
  for (let i = deliveries.length - 1; i >= 0; i--) {
    if (deliveries[i].wicket_type) {
      lastWicketIndex = i;
      break;
    }
  }
  
  const partnershipDeliveries = deliveries.slice(lastWicketIndex + 1);
  let runs = 0;
  let balls = 0;
  partnershipDeliveries.forEach(d => {
    runs += (d.runs_batter || 0) + (d.runs_extras || 0);
    if (d.is_legal !== false) {
      balls += 1;
    }
  });
  
  return { runs, balls };
};

const getTargetBadgeInfo = (state) => {
  if (!state) return "No live match state";
  if (state.current_innings !== 2 || state.innings1_score === null || state.innings1_score === undefined) {
    return "1st Innings in progress";
  }
  const target = state.innings1_score + 1;
  const runsNeeded = target - state.total_runs;
  
  const totalOvers = state.overs_quota || 20;
  const totalBalls = totalOvers * 6;
  const ballsBowled = (state.overs || 0) * 6 + (state.balls_in_over || 0);
  const ballsRemaining = Math.max(0, totalBalls - ballsBowled);
  
  return `Target: ${target} • Need ${runsNeeded} runs off ${ballsRemaining} balls`;
};

const getRunRatesInfo = (state) => {
  if (!state) return "CRR: 0.00";
  const crr = state.run_rate || 0.00;
  if (state.current_innings !== 2 || state.innings1_score === null || state.innings1_score === undefined) {
    return `CRR: ${crr.toFixed(2)}`;
  }
  
  const target = state.innings1_score + 1;
  const runsNeeded = target - state.total_runs;
  const totalOvers = state.overs_quota || 20;
  const totalBalls = totalOvers * 6;
  const ballsBowled = (state.overs || 0) * 6 + (state.balls_in_over || 0);
  const ballsRemaining = Math.max(0, totalBalls - ballsBowled);
  
  const rrr = ballsRemaining > 0 ? (runsNeeded / (ballsRemaining / 6)) : 0.00;
  return `CRR: ${crr.toFixed(2)} • RRR: ${rrr.toFixed(2)}`;
};

const getExtrasBreakdown = (state) => {
  if (!state || !state.delivery_history) return "Extras: 0";
  
  let w = 0, n = 0, b = 0, l = 0;
  state.delivery_history.forEach(d => {
    if (d.extra_type === 'WIDE') w += d.runs_extras;
    else if (d.extra_type === 'NO_BALL') n += d.runs_extras;
    else if (d.extra_type === 'BYES') b += d.runs_extras;
    else if (d.extra_type === 'LEG_BYES') l += d.runs_extras;
  });
  
  const total = w + n + b + l;
  return `Extras: ${total} (Wd ${w}, Nb ${n}, B ${b}, Lb ${l})`;
};

const getMatchInfo = (state) => {
  if (!state) return "";
  return `${state.toss_winner || 'Toss Winner'} won toss, elected to ${state.elected_to || 'Bat/Bowl'} first`;
};

// Canvas Particle System Overlay Component
function CanvasOverlay({ type, active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let particles = [];
    const width = 1920;
    const height = 1080;

    canvas.width = width;
    canvas.height = height;

    if (type === 'wicket') {
      // Dark red and black crystal shards exploding from center
      for (let i = 0; i < 90; i++) {
        particles.push({
          x: width / 2,
          y: height / 2,
          vx: (Math.random() - 0.5) * 28,
          vy: (Math.random() - 0.7) * 24 - 6,
          size: Math.random() * 25 + 10,
          color: Math.random() > 0.4 ? '#991b1b' : (Math.random() > 0.5 ? '#db2777' : '#0f172a'),
          alpha: 1,
          rotation: Math.random() * Math.PI * 2,
          vRotation: (Math.random() - 0.5) * 0.15,
          shape: Math.random() > 0.5 ? 'triangle' : 'polygon',
          gravity: 0.28
        });
      }
    } else if (type === 'four') {
      // Cyan sparkles shooting up from bottom
      for (let i = 0; i < 110; i++) {
        particles.push({
          x: Math.random() * width,
          y: height + 15,
          vx: (Math.random() - 0.5) * 9,
          vy: -Math.random() * 18 - 8,
          size: Math.random() * 6 + 2,
          color: '#06b6d4',
          alpha: 1,
          gravity: 0.12,
          trail: []
        });
      }
    } else if (type === 'six') {
      // Gold sparkles radiating from top-center
      for (let i = 0; i < 160; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 18 + 6;
        particles.push({
          x: width / 2,
          y: height / 3,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 7 + 3,
          color: Math.random() > 0.3 ? '#fbbf24' : '#f59e0b',
          alpha: 1,
          gravity: 0.16
        });
      }
    } else if (type === 'milestone') {
      // Shimmering gold curtains rain
      for (let i = 0; i < 130; i++) {
        particles.push({
          x: Math.random() * width,
          y: -20 - Math.random() * 100,
          vx: (Math.random() - 0.5) * 4,
          vy: Math.random() * 4 + 2,
          size: Math.random() * 5 + 2,
          color: '#fbbf24',
          alpha: 0.75 + Math.random() * 0.25,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: Math.random() * 0.06 + 0.02
        });
      }
    }

    const update = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        if (type === 'wicket') {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.rotation += p.vRotation;
          p.alpha -= 0.012;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);

          if (p.shape === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(0, -p.size);
            ctx.lineTo(p.size, p.size);
            ctx.lineTo(-p.size, p.size);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          }
          ctx.restore();
        } else if (type === 'four') {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.alpha -= 0.014;

          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 9) p.trail.shift();

          ctx.beginPath();
          p.trail.forEach((pt, idx) => {
            ctx.globalAlpha = (idx / p.trail.length) * Math.max(0, p.alpha);
            ctx.fillStyle = p.color;
            ctx.fillRect(pt.x - p.size / 2, pt.y - p.size / 2, p.size, p.size);
          });
        } else if (type === 'six') {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.alpha -= 0.018;

          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#f59e0b';

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (type === 'milestone') {
          p.y += p.vy;
          p.wobble += p.wobbleSpeed;
          p.x += Math.sin(p.wobble) * 1.8;
          if (p.y > height) {
            p.y = -20;
            p.x = Math.random() * width;
          }

          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      particles = particles.filter((p) => p.alpha > 0);

      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(update);
      }
    };

    update();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [type, active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '1920px',
        height: '1080px',
        pointerEvents: 'none',
        zIndex: 99
      }}
    />
  );
}

export default function BroadcastView() {
  const [matchState, setMatchState] = useState(null);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');

  // Animation Triggers
  const [activeAnimation, setActiveAnimation] = useState('none');
  const [animationData, setAnimationData] = useState(null);

  // Milestone triggers
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneData, setMilestoneData] = useState(null);

  // Stat card caches
  const [activeStatCard, setActiveStatCard] = useState('none'); // 'none', 'batter', 'bowler'
  const [statCardData, setStatCardData] = useState(null);
  const [cachedStatData, setCachedStatData] = useState(null);
  const [cachedStatType, setCachedStatType] = useState('none');

  // Micro-interactions state
  const [spinRuns, setSpinRuns] = useState(false);
  const [burstFour, setBurstFour] = useState(false);
  const [burstSix, setBurstSix] = useState(false);
  const [timelineWicket, setTimelineWicket] = useState(false);
  const [sweepTimeline, setSweepTimeline] = useState(false);

  // Refs for tracking changes
  const prevWickets = useRef(0);
  const prevTimelineLength = useRef(0);
  const prevStrikerRuns = useRef(0);
  const prevNonStrikerRuns = useRef(0);
  const prevStrikerName = useRef('');
  const prevBowlerName = useRef('');

  const params = new URLSearchParams(window.location.search);
  const urlMatchId = params.get('matchId');

  useEffect(() => {
    document.body.classList.add('broadcast-mode');
    return () => {
      document.body.classList.remove('broadcast-mode');
    };
  }, []);

  // Main subscription and sync logic
  useEffect(() => {
    const supabase = getSupabaseClient();
    const creds = getSupabaseCredentials();
    const matchId = urlMatchId || creds.matchId || 'local';

    // Load initial layout cache
    const localLayoutData = localStorage.getItem(`cricdeck_layout_${matchId}`);
    if (localLayoutData) {
      try {
        const parsed = JSON.parse(localLayoutData);
        if (parsed.layout) setLayout(parsed.layout);
        if (parsed.backgroundUrl) setBackgroundUrl(parsed.backgroundUrl);
      } catch (e) {
        console.error('Failed to parse cached local layout:', e);
      }
    }

    // Load initial match cache
    const localMatchData = localStorage.getItem(`cricdeck_match_${matchId}`);
    if (localMatchData) {
      try {
        setMatchState(JSON.parse(localMatchData));
      } catch (e) {
        console.error('Failed to parse cached local match state:', e);
      }
    }

    // Sync via local BroadcastChannel
    const localChannel = new BroadcastChannel('cricdeck_sync');
    localChannel.onmessage = (event) => {
      if (event.data) {
        if (event.data.type === 'match_update') {
          setMatchState(event.data.state);
        } else if (event.data.type === 'layout_update') {
          if (event.data.layout) setLayout(event.data.layout);
          if (event.data.backgroundUrl !== undefined) setBackgroundUrl(event.data.backgroundUrl);
        }
      }
    };

    if (!supabase || matchId === 'local') {
      setConnectionStatus('Local Sync Mode (Offline)');
      return () => localChannel.close();
    }

    // Fetch from Supabase
    const fetchSupabaseData = async () => {
      setConnectionStatus('Connecting to Supabase...');
      try {
        const { data: layoutData } = await supabase
          .from('custom_layouts')
          .select('layout_data, background_url')
          .eq('match_id', matchId)
          .maybeSingle();

        if (layoutData) {
          if (layoutData.layout_data && Object.keys(layoutData.layout_data).length > 0) {
            setLayout(layoutData.layout_data);
          }
          if (layoutData.background_url) {
            setBackgroundUrl(layoutData.background_url);
          }
        }

        const { data: scoreData } = await supabase
          .from('live_scores')
          .select('*')
          .eq('match_id', matchId)
          .maybeSingle();

        const { data: matchData } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .maybeSingle();

        if (scoreData && matchData) {
          setMatchState({
            ...matchData,
            ...scoreData,
            striker: typeof scoreData.striker === 'string' ? JSON.parse(scoreData.striker) : (scoreData.striker || { name: '', runs: 0, balls: 0, fours: 0, sixes: 0 }),
            non_striker: typeof scoreData.non_striker === 'string' ? JSON.parse(scoreData.non_striker) : (scoreData.non_striker || { name: '', runs: 0, balls: 0, fours: 0, sixes: 0 }),
            current_bowler: typeof scoreData.current_bowler === 'string' ? JSON.parse(scoreData.current_bowler) : (scoreData.current_bowler || { name: '', overs: 0, runs: 0, wickets: 0, maidens: 0, balls: 0 }),
            current_over_timeline: scoreData.current_over_timeline || []
          });
          setConnectionStatus('Supabase Connected');
        }
      } catch (err) {
        console.error('Error loading Supabase data:', err);
      }
    };

    fetchSupabaseData();

    // Subscribe to changes
    const scoreChannel = supabase
      .channel(`broadcast-scores-${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_scores', filter: `match_id=eq.${matchId}` }, (payload) => {
        const score = payload.new;
        setMatchState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            total_runs: score.total_runs,
            wickets: score.wickets,
            overs: score.overs,
            balls_in_over: score.balls_in_over,
            run_rate: score.run_rate,
            striker: typeof score.striker === 'string' ? JSON.parse(score.striker) : score.striker,
            non_striker: typeof score.non_striker === 'string' ? JSON.parse(score.non_striker) : score.non_striker,
            current_bowler: typeof score.current_bowler === 'string' ? JSON.parse(score.current_bowler) : score.current_bowler,
            current_over_timeline: score.current_over_timeline || []
          };
        });
      })
      .subscribe();

    const matchChannel = supabase
      .channel(`broadcast-match-${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, (payload) => {
        setMatchState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            team_a: payload.new.team_a,
            team_b: payload.new.team_b,
            toss_winner: payload.new.toss_winner,
            elected_to: payload.new.elected_to,
            current_innings: payload.new.current_innings,
            status: payload.new.status
          };
        });
      })
      .subscribe();

    const layoutChannel = supabase
      .channel(`broadcast-layout-${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'custom_layouts', filter: `match_id=eq.${matchId}` }, (payload) => {
        if (payload.new.layout_data) setLayout(payload.new.layout_data);
        if (payload.new.background_url !== undefined) setBackgroundUrl(payload.new.background_url);
      })
      .subscribe();

    return () => {
      localChannel.close();
      supabase.removeChannel(scoreChannel);
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(layoutChannel);
    };
  }, [urlMatchId]);

  // Stat Card cache synchronization
  useEffect(() => {
    if (activeStatCard !== 'none') {
      setCachedStatData(statCardData);
      setCachedStatType(activeStatCard);
    }
  }, [activeStatCard, statCardData]);

  // Watch for state transitions to trigger overlays and animations
  useEffect(() => {
    if (!matchState) return;

    // Avoid false triggers on initial mount
    const hasPriorData = prevWickets.current > 0 || prevTimelineLength.current > 0 || prevStrikerName.current !== '';

    if (hasPriorData) {
      // 1. Wicket Trigger
      if (matchState.wickets > prevWickets.current) {
        const lastDelivery = matchState.delivery_history?.[matchState.delivery_history.length - 1];
        const playerDismissed = lastDelivery?.dismissed_batter_name || matchState.striker?.name || 'Batter';
        const wType = lastDelivery?.wicket_type || 'OUT';
        const bowler = lastDelivery?.bowler_name || matchState.current_bowler?.name || 'Bowler';

        setTimelineWicket(true);
        setTimeout(() => setTimelineWicket(false), 800);

        setActiveAnimation('wicket');
        setAnimationData({ name: playerDismissed, type: wType, bowler });
        setTimeout(() => {
          setActiveAnimation('none');
          setAnimationData(null);
        }, 3600);
      }
      // 2. Boundary Trigger
      else if (matchState.current_over_timeline && matchState.current_over_timeline.length > prevTimelineLength.current) {
        const lastBall = matchState.current_over_timeline[matchState.current_over_timeline.length - 1];
        if (lastBall === '4') {
          setActiveAnimation('four');
          setTimeout(() => setActiveAnimation('none'), 3000);
        } else if (lastBall === '6') {
          setActiveAnimation('six');
          setTimeout(() => setActiveAnimation('none'), 3000);
        }
      }

      // 3. Batter Milestone Triggers
      const checkMilestone = (name, runs, prevRunsVal) => {
        if (runs >= 50 && prevRunsVal < 50) {
          setMilestoneData({ name, runs: 50 });
          setShowMilestone(true);
          setTimeout(() => setShowMilestone(false), 3800);
        } else if (runs >= 100 && prevRunsVal < 100) {
          setMilestoneData({ name, runs: 100 });
          setShowMilestone(true);
          setTimeout(() => setShowMilestone(false), 3800);
        }
      };

      if (matchState.striker?.name) {
        checkMilestone(matchState.striker.name, matchState.striker.runs, prevStrikerRuns.current);
      }
      if (matchState.non_striker?.name) {
        checkMilestone(matchState.non_striker.name, matchState.non_striker.runs, prevNonStrikerRuns.current);
      }

      // 4. Over Transition & Stat Card displays
      const isOverComplete = (matchState.balls_in_over === 0 && prevTimelineLength.current > 0);
      if (isOverComplete) {
        triggerBowlerStatCard(matchState.current_bowler);
      } else {
        // Trigger batter card on new player arrival
        if (matchState.striker?.name && matchState.striker.name !== prevStrikerName.current) {
          triggerBatterStatCard(matchState.striker);
        }
        if (matchState.current_bowler?.name && matchState.current_bowler.name !== prevBowlerName.current) {
          triggerBowlerStatCard(matchState.current_bowler);
        }
      }
    }

    // Micro-interactions checks
    if (matchState.total_runs !== prevRuns.current) {
      setSpinRuns(true);
      setTimeout(() => setSpinRuns(false), 600);
    }
    if (matchState.striker?.fours > prevStrikerFours.current) {
      setBurstFour(true);
      setTimeout(() => setBurstFour(false), 800);
    }
    if (matchState.striker?.sixes > prevStrikerSixes.current) {
      setBurstSix(true);
      setTimeout(() => setBurstSix(false), 800);
    }

    // Over sweep check
    if (matchState.current_over_timeline.length === 0 && prevTimelineLength.current > 0) {
      setSweepTimeline(true);
      setTimeout(() => setSweepTimeline(false), 800);
    }

    // Update state tracking refs
    prevRuns.current = matchState.total_runs;
    prevWickets.current = matchState.wickets;
    prevTimelineLength.current = matchState.current_over_timeline?.length || 0;
    prevStrikerRuns.current = matchState.striker?.runs || 0;
    prevNonStrikerRuns.current = matchState.non_striker?.runs || 0;
    prevStrikerFours.current = matchState.striker?.fours || 0;
    prevStrikerSixes.current = matchState.striker?.sixes || 0;
    prevStrikerName.current = matchState.striker?.name || '';
    prevBowlerName.current = matchState.current_bowler?.name || '';
  }, [matchState]);

  const prevRuns = useRef(0);
  const prevStrikerFours = useRef(0);
  const prevStrikerSixes = useRef(0);

  const triggerBatterStatCard = (batter) => {
    if (!batter || !batter.name) return;
    setActiveStatCard('batter');
    setStatCardData(batter);
    const t = setTimeout(() => setActiveStatCard('none'), 7000);
    return () => clearTimeout(t);
  };

  const triggerBowlerStatCard = (bowler) => {
    if (!bowler || !bowler.name) return;
    setActiveStatCard('bowler');
    setStatCardData(bowler);
    const t = setTimeout(() => setActiveStatCard('none'), 7000);
    return () => clearTimeout(t);
  };

  // Helper styles for widgets
  const getWidgetStyle = (config) => ({
    position: 'absolute',
    left: `${config.x}px`,
    top: `${config.y}px`,
    fontSize: `${config.fontSize}px`,
    color: config.fontColor,
    fontFamily: config.fontFamily || 'Inter',
    transform: `scale(${config.scale || 1.0})`,
    transformOrigin: 'top left',
    display: config.visible ? 'block' : 'none',
    backgroundColor: config.opacity > 0.05 ? (config.backgroundColor || 'rgba(8, 12, 28, 0.85)') : 'transparent',
    backdropFilter: config.opacity > 0.05 ? 'blur(20px)' : 'none',
    border: config.opacity > 0.05 ? '1.5px solid rgba(255,255,255,0.15)' : 'none',
    boxShadow: config.opacity > 0.05 ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : 'none',
    textShadow: config.opacity <= 0.05 ? '2px 2px 4px rgba(0, 0, 0, 0.95), -1px -1px 0px rgba(0,0,0,0.8), 1px -1px 0px rgba(0,0,0,0.8), -1px 1px 0px rgba(0,0,0,0.8), 1px 1px 0px rgba(0,0,0,0.8)' : 'none',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  });

  const activeBatState = matchState || {
    team_a: 'WARRIORS',
    team_b: 'TITANS',
    total_runs: 0,
    wickets: 0,
    overs: 0,
    balls_in_over: 0,
    run_rate: 0.00,
    current_innings: 1,
    striker: { name: 'Batter 1', runs: 0, balls: 0, fours: 0, sixes: 0 },
    non_striker: { name: 'Batter 2', runs: 0, balls: 0, fours: 0, sixes: 0 },
    current_bowler: { name: 'Bowler', overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 },
    current_over_timeline: []
  };

  // Compute stats for circular progress rings
  const totalBatterRuns = cachedStatData?.runs || 0;
  const boundaryRuns = ((cachedStatData?.fours || 0) * 4) + ((cachedStatData?.sixes || 0) * 6);
  const boundaryPercent = totalBatterRuns > 0 ? Math.round((boundaryRuns / totalBatterRuns) * 100) : 0;

  const strikerSR = activeBatState.striker.balls > 0 ? ((activeBatState.striker.runs / activeBatState.striker.balls) * 100) : 0;
  const nonStrikerSR = activeBatState.non_striker.balls > 0 ? ((activeBatState.non_striker.runs / activeBatState.non_striker.balls) * 100) : 0;

  const showStrikerFlame = strikerSR >= 140 && activeBatState.striker.runs >= 12;
  const showNonStrikerFlame = nonStrikerSR >= 140 && activeBatState.non_striker.runs >= 12;

  // Chase target computation
  const target = activeBatState.innings1_score ? activeBatState.innings1_score + 1 : null;

  return (
    <div
      className="broadcast-viewport"
      style={{
        width: '1920px',
        height: '1080px',
        position: 'relative',
        background: 'transparent',
        backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        overflow: 'hidden'
      }}
    >
      <style>{`
        /* --- Premium ICC WC 2023 theme Styles --- */
        .premium-panel {
          background: rgba(8, 12, 28, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1.5px solid rgba(236, 72, 153, 0.35);
          box-shadow: 0 8px 32px 0 rgba(236, 72, 153, 0.15), inset 0 0 15px rgba(6, 182, 212, 0.1);
          border-radius: 12px;
          padding: 12px 20px;
          overflow: hidden;
          position: relative;
        }

        .premium-panel::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%);
          pointer-events: none;
        }

        .neon-top-bar {
          position: absolute;
          top: 0; left: 0; height: 3px; width: 100%;
          background: linear-gradient(90deg, #db2777, #06b6d4);
        }

        /* 3D Spin Cycle Animation */
        @keyframes spin-cycle {
          0% { transform: rotateX(0deg) scale(1); text-shadow: 0 0 0px #06b6d4; }
          30% { transform: rotateX(90deg) scale(1.1); text-shadow: 0 0 12px #06b6d4; color: #06b6d4; }
          70% { transform: rotateX(-90deg) scale(1.1); text-shadow: 0 0 12px #06b6d4; color: #06b6d4; }
          100% { transform: rotateX(0deg) scale(1); text-shadow: 0 0 0px #06b6d4; }
        }
        .spin-active {
          display: inline-block;
          animation: spin-cycle 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.2);
        }

        /* Gold Boundary Burst */
        @keyframes gold-burst {
          0% { transform: scale(1); text-shadow: 0 0 0px transparent; }
          50% { transform: scale(1.3); text-shadow: 0 0 15px #f59e0b; color: #f59e0b; }
          100% { transform: scale(1); text-shadow: 0 0 0px transparent; }
        }
        .burst-active {
          animation: gold-burst 0.75s ease-out;
        }

        /* Fire / Flame Icon Pulse */
        @keyframes flame-pulse {
          0%, 100% { transform: scale(1); opacity: 0.95; filter: drop-shadow(0 0 2px #ef4444); }
          50% { transform: scale(1.2); opacity: 1; filter: drop-shadow(0 0 8px #f57c00); }
        }
        .flame-pulse-active {
          animation: flame-pulse 1.2s infinite ease-in-out;
          color: #f97316;
          margin-left: 5px;
        }

        /* Liquid Motion Transition for Stat Cards */
        @keyframes liquid-flow {
          0% {
            clip-path: circle(0% at 100% 50%);
            transform: scale(0.85) translateY(30px);
            opacity: 0;
          }
          60% {
            clip-path: circle(75% at 50% 50%);
            transform: scale(1.04) translateY(-5px);
            opacity: 1;
          }
          100% {
            clip-path: circle(120% at 50% 50%);
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
        .stat-card-wrapper {
          position: absolute;
          right: -420px;
          bottom: 180px;
          width: 380px;
          transition: right 0.8s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s;
          opacity: 0;
          z-index: 90;
        }
        .stat-card-wrapper.slide-in {
          right: 80px;
          opacity: 1;
          animation: liquid-flow 0.95s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Metallic Luster Shine */
        @keyframes shine-anim {
          0% { transform: translateX(-100%) skewX(-30deg); }
          40%, 100% { transform: translateX(120%) skewX(-30deg); }
        }
        .metallic-shine {
          position: absolute;
          top: 0; left: 0; width: 200%; height: 100%;
          background: linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.08) 40%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.08) 60%, transparent 70%);
          animation: shine-anim 3.5s infinite linear;
          pointer-events: none;
        }

        /* Over Completion wind-blur */
        @keyframes sweep-out {
          0% { transform: translateX(0) skewX(0); filter: blur(0); opacity: 1; }
          30% { transform: translateX(-60px) skewX(12deg); filter: blur(6px); opacity: 0; }
          40% { transform: translateX(60px) skewX(-12deg); filter: blur(6px); opacity: 0; }
          100% { transform: translateX(0) skewX(0); filter: blur(0); opacity: 1; }
        }
        .wind-blur-active {
          animation: sweep-out 0.75s forwards;
        }

        /* Wicket timeline shake */
        @keyframes shake-anim {
          0%, 100% { transform: translate(0, 0); }
          10%, 50%, 90% { transform: translate(-3px, -2px); }
          30%, 70% { transform: translate(3px, 2px); }
        }
        .wicket-shake-active {
          animation: shake-anim 0.5s;
        }

        /* Full screen overlay designs */
        .fullscreen-overlay {
          position: absolute;
          top: 0; left: 0; width: 1920px; height: 1080px;
          z-index: 100;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          animation: fade-in-out-overlay 3s forwards;
        }

        @keyframes fade-in-out-overlay {
          0% { opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { opacity: 0; }
        }

        .wicket-overlay {
          background: rgba(15, 7, 18, 0.9);
          border: 4px solid #db2777;
          box-shadow: inset 0 0 100px rgba(219,39,119,0.3);
        }

        .out-text {
          font-size: 150px;
          font-weight: 900;
          color: #fff;
          letter-spacing: 12px;
          text-shadow: 0 0 40px #db2777, 0 0 80px #db2777;
          animation: shatter-scale 0.55s cubic-bezier(0.175, 0.885, 0.32, 1.25);
        }

        @keyframes shatter-scale {
          0% { transform: scale(0.3) rotate(-10deg); filter: blur(10px); }
          100% { transform: scale(1) rotate(0); filter: blur(0); }
        }

        .dismissal-details {
          text-align: center;
          margin-top: 20px;
          color: #fff;
          animation: slide-up-details 0.6s 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes slide-up-details {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .boundary-text {
          font-size: 160px;
          font-weight: 950;
          letter-spacing: 10px;
          animation: scale-up-bounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.3) both;
        }

        .cyan-neon {
          color: #fff;
          text-shadow: 0 0 30px #06b6d4, 0 0 60px #06b6d4;
        }

        .gold-neon {
          color: #fff;
          text-shadow: 0 0 35px #fbbf24, 0 0 70px #fbbf24;
        }

        @keyframes scale-up-bounce {
          0% { transform: scale(0.4) rotate(5deg); }
          60% { transform: scale(1.1) rotate(-2deg); }
          100% { transform: scale(1) rotate(0); }
        }

        /* Milestones curtains */
        .curtain-l, .curtain-r {
          position: absolute;
          top: 0; width: 50%; height: 100%;
          background: linear-gradient(135deg, #090e18 0%, #1e1330 100%);
          z-index: 102;
          transition: transform 0.8s cubic-bezier(0.77, 0, 0.175, 1);
        }
        .curtain-l { left: 0; transform: translateX(-100%); border-right: 4px solid #fbbf24; }
        .curtain-r { right: 0; transform: translateX(100%); border-left: 4px solid #fbbf24; }
        .curtain-l.active { transform: translateX(0); }
        .curtain-r.active { transform: translateX(0); }

        .milestone-text-container {
          position: absolute;
          top: 0; left: 0; width: 1920px; height: 1080px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 103;
          opacity: 0;
          transform: scale(0.85);
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
          text-align: center;
        }
        .milestone-text-container.active {
          opacity: 1;
          transform: scale(1);
        }

        /* SVG Circular Ring design */
        .radial-ring-container {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          width: 90px;
          height: 90px;
        }

        .progress-ring-circle {
          transition: stroke-dashoffset 0.85s ease-in-out;
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
        }

        /* target icon chase display */
        .target-box-chase {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.35);
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 0.85rem;
          color: #fbbf24;
          font-weight: 600;
        }
      `}</style>

      {/* Connection Mode overlay during startup */}
      {!matchState && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(6,10,25,0.9)',
          padding: '12px 22px',
          borderRadius: '8px',
          color: '#fff',
          fontFamily: 'sans-serif',
          fontSize: '14px',
          border: '1.5px solid rgba(236,72,153,0.3)',
          zIndex: 999
        }}>
          <strong>CricDeck Live Overlay Engine</strong>
          <div style={{ opacity: 0.7, marginTop: '4px', fontSize: '12px' }}>{connectionStatus}</div>
        </div>
      )}

      {/* Particle Overlay System */}
      <CanvasOverlay type={activeAnimation} active={activeAnimation !== 'none' || showMilestone} />

      {/* --- Full-Screen Animations Overlay --- */}
      {/* 1. Wicket Screen */}
      {activeAnimation === 'wicket' && (
        <div className="fullscreen-overlay wicket-overlay">
          <div className="out-text">OUT</div>
          {animationData && (
            <div className="dismissal-details">
              <h2 style={{ fontSize: '48px', fontWeight: '800', marginBottom: '8px', textTransform: 'uppercase' }}>
                {animationData.name}
              </h2>
              <p style={{ fontSize: '20px', opacity: 0.8, color: '#f87171', fontWeight: '600', letterSpacing: '2px' }}>
                {animationData.type.replace(/_/g, ' ').toUpperCase()} • BOWLED BY {animationData.bowler.toUpperCase()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2. Boundary Fours Screen */}
      {activeAnimation === 'four' && (
        <div className="fullscreen-overlay" style={{ background: 'rgba(8, 12, 28, 0.65)' }}>
          <div className="boundary-text cyan-neon">FOUR!</div>
        </div>
      )}

      {/* 3. Boundary Sixes Screen */}
      {activeAnimation === 'six' && (
        <div className="fullscreen-overlay" style={{ background: 'rgba(8, 12, 28, 0.65)' }}>
          <div className="boundary-text gold-neon">SIX!</div>
        </div>
      )}

      {/* 4. Milestones Curtains & Center Overlay */}
      <div>
        <div className={`curtain-l ${showMilestone ? 'active' : ''}`} />
        <div className={`curtain-r ${showMilestone ? 'active' : ''}`} />
        <div className={`milestone-text-container ${showMilestone ? 'active' : ''}`}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #fbbf24', padding: '8px 20px', borderRadius: '50px', fontSize: '18px', color: '#fbbf24', fontWeight: '800', letterSpacing: '4px', marginBottom: '12px' }}>
            CRICDECK MILESTONE
          </div>
          <h1 style={{ fontSize: '72px', color: '#fff', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px' }}>
            {milestoneData?.name}
          </h1>
          <div style={{ fontSize: '120px', fontWeight: '950', color: '#fbbf24', lineHeight: 1, textShadow: '0 0 30px rgba(245,158,11,0.5)' }}>
            {milestoneData?.runs}
          </div>
          <div style={{ fontSize: '24px', color: '#fff', fontWeight: '750', letterSpacing: '3px', marginTop: '10px' }}>
            RUNS COMPLETED!
          </div>
        </div>
      </div>

      {/* --- Contextual Stat Cards --- */}
      {cachedStatData && (
        <div className={`premium-panel stat-card-wrapper ${activeStatCard !== 'none' ? 'slide-in' : ''}`}>
          <div className="neon-top-bar" />
          <div className="metallic-shine" />
          
          {cachedStatType === 'batter' ? (
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#db2777', fontWeight: '800', letterSpacing: '2px' }}>BATTER STATISTICS</span>
              <h3 style={{ fontSize: '24px', fontWeight: '850', color: '#fff', margin: '4px 0 12px 0' }}>{cachedStatData.name}</h3>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Runs Scored</span>
                    <strong style={{ fontSize: '22px', color: '#fff' }}>{cachedStatData.runs} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'rgba(255,255,255,0.5)' }}>({cachedStatData.balls}b)</span></strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Strike Rate</span>
                    <strong style={{ fontSize: '20px', color: '#06b6d4' }}>{totalBatterRuns > 0 ? ((cachedStatData.runs / cachedStatData.balls) * 100).toFixed(1) : '0.0'}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <div className="radial-ring-container">
                    <svg width="84" height="84" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="8" />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="40" 
                        fill="transparent" 
                        stroke="#06b6d4" 
                        strokeWidth="8"
                        className="progress-ring-circle"
                        strokeDasharray={2 * Math.PI * 40}
                        strokeDashoffset={2 * Math.PI * 40 * (1 - boundaryPercent / 100)}
                        strokeLinecap="round"
                      />
                      <text x="50" y="56" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold" fontFamily="sans-serif">
                        {boundaryPercent}%
                      </text>
                    </svg>
                  </div>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Runs In Boundaries</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#06b6d4', fontWeight: '800', letterSpacing: '2px' }}>BOWLER STATISTICS</span>
              <h3 style={{ fontSize: '24px', fontWeight: '850', color: '#fff', margin: '4px 0 12px 0' }}>{cachedStatData.name}</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Overs Bowled</span>
                  <strong style={{ fontSize: '20px', color: '#fff' }}>{cachedStatData.overs || 0}.{cachedStatData.balls || 0}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Wickets</span>
                  <strong style={{ fontSize: '20px', color: '#db2777' }}>{cachedStatData.wickets || 0}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Runs Conceded</span>
                  <strong style={{ fontSize: '20px', color: '#fff' }}>{cachedStatData.runs || 0}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Economy Rate</span>
                  <strong style={{ fontSize: '20px', color: '#fbbf24' }}>
                    {((cachedStatData.overs * 6 + cachedStatData.balls) > 0)
                      ? ((cachedStatData.runs / (cachedStatData.overs * 6 + cachedStatData.balls)) * 6).toFixed(2)
                      : '0.00'}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Scorecard Layout Widgets --- */}

      {/* 1. Team Scores Widget */}
      {layout.team_scores.visible && (
        <div style={getWidgetStyle(layout.team_scores)} className="premium-panel">
          <div className="neon-top-bar" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.52em', opacity: 0.65, fontWeight: '750', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#06b6d4' }}>
              {activeBatState.team_a} VS {activeBatState.team_b}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontWeight: '900' }}>
              <span className={spinRuns ? 'spin-active' : ''} style={{ fontSize: '1.25em' }}>
                {activeBatState.total_runs}/{activeBatState.wickets}
              </span>
              <span style={{ fontSize: '0.65em', opacity: 0.8, fontWeight: 'normal', color: 'rgba(255,255,255,0.7)' }}>
                ({activeBatState.overs}.{activeBatState.balls_in_over} Ov)
              </span>
            </div>
            {target && (
              <div className="target-box-chase" style={{ marginTop: '4px' }}>
                <span>🎯 Target: {target}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Active Batters Widget */}
      {layout.active_batters.visible && (
        <div style={getWidgetStyle(layout.active_batters)} className="premium-panel">
          <div className="neon-top-bar" />
          <div style={{ display: 'flex', gap: '24px', fontSize: '0.85em', alignItems: 'center', height: '100%' }}>
            
            {/* Striker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '7px', height: '7px', backgroundColor: '#06b6d4', borderRadius: '50%', boxShadow: '0 0 8px #06b6d4' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ display: 'flex', alignItems: 'center', fontWeight: '800', color: '#fff' }}>
                  {activeBatState.striker.name || 'Striker'}
                  {showStrikerFlame && (
                    <span className="flame-pulse-active">🔥</span>
                  )}
                </span>
                <span className={burstFour || burstSix ? 'burst-active' : ''} style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.7)' }}>
                  {activeBatState.striker.runs || 0} <span style={{ fontSize: '0.8em', opacity: 0.6 }}>({activeBatState.striker.balls || 0}b)</span>
                </span>
              </div>
            </div>

            <div style={{ opacity: 0.25, fontSize: '1.2em' }}>|</div>

            {/* Non-Striker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '7px', height: '7px', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: '50%' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '700', color: 'rgba(255,255,255,0.75)' }}>
                  {activeBatState.non_striker.name || 'Non-Striker'}
                  {showNonStrikerFlame && (
                    <span className="flame-pulse-active">🔥</span>
                  )}
                </span>
                <span style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.5)' }}>
                  {activeBatState.non_striker.runs || 0} <span style={{ fontSize: '0.8em', opacity: 0.6 }}>({activeBatState.non_striker.balls || 0}b)</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Current Bowler Widget */}
      {layout.current_bowler.visible && (
        <div style={getWidgetStyle(layout.current_bowler)} className="premium-panel">
          <div className="neon-top-bar" />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: '2px' }}>
            <span style={{ fontSize: '0.52em', opacity: 0.6, fontWeight: '750', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#db2777' }}>
              CURRENT BOWLER
            </span>
            <strong style={{ fontSize: '0.9em', color: '#fff' }}>{activeBatState.current_bowler.name || 'Bowler'}</strong>
            <span style={{ fontSize: '0.8em', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
              O:{activeBatState.current_bowler.overs || 0}.{activeBatState.current_bowler.balls || 0} M:{activeBatState.current_bowler.maidens || 0} R:{activeBatState.current_bowler.runs || 0} W:{activeBatState.current_bowler.wickets || 0}
            </span>
          </div>
        </div>
      )}

      {/* 4. Over Timeline Widget */}
      {layout.timeline.visible && (
        <div style={getWidgetStyle(layout.timeline)} className="premium-panel">
          <div className="neon-top-bar" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.52em', opacity: 0.6, fontWeight: '750', textTransform: 'uppercase', letterSpacing: '1.5px', color: '#fbbf24' }}>
              THIS OVER
            </span>
            <div className={`this-over-tracker ${sweepTimeline ? 'wind-blur-active' : ''} ${timelineWicket ? 'wicket-shake-active' : ''}`}>
              {activeBatState.current_over_timeline.length === 0 ? (
                <span style={{ fontSize: '0.85em', opacity: 0.3, letterSpacing: '4px' }}>••••••</span>
              ) : (
                activeBatState.current_over_timeline.map((ball, i) => {
                  let styleBg = 'rgba(255,255,255,0.06)';
                  let styleBorder = '1px solid rgba(255,255,255,0.15)';
                  let styleColor = '#fff';
                  let shadowClass = '';

                  if (ball === '4') {
                    styleBg = 'rgba(6, 182, 212, 0.25)';
                    styleBorder = '1px solid #06b6d4';
                    styleColor = '#06b6d4';
                  } else if (ball === '6') {
                    styleBg = 'rgba(245, 158, 11, 0.25)';
                    styleBorder = '1px solid #fbbf24';
                    styleColor = '#fbbf24';
                    shadowClass = 'flame-pulse-active';
                  } else if (ball === 'W') {
                    styleBg = 'rgba(239, 68, 68, 0.25)';
                    styleBorder = '1px solid #ef4444';
                    styleColor = '#ef4444';
                  } else if (ball.includes('Wd') || ball.includes('NB') || ball.includes('B') || ball.includes('LB')) {
                    styleBg = 'rgba(168, 85, 247, 0.25)';
                    styleBorder = '1px solid #a855f7';
                    styleColor = '#a855f7';
                  }

                  return (
                    <div
                      key={i}
                      className={shadowClass}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        backgroundColor: styleBg,
                        border: styleBorder,
                        color: styleColor,
                        fontSize: '10px',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1
                      }}
                    >
                      {ball}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Active Partnership Widget */}
      {layout.partnership?.visible && (
        <div style={getWidgetStyle(layout.partnership)} className="premium-panel">
          <div className="neon-top-bar" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85em', fontWeight: 'bold' }}>
              Partnership: {getPartnershipStats(activeBatState).runs} runs off {getPartnershipStats(activeBatState).balls} balls
            </span>
          </div>
        </div>
      )}

      {/* 6. Target Info Widget */}
      {layout.target_badge?.visible && (
        <div style={getWidgetStyle(layout.target_badge)} className="premium-panel">
          <div className="neon-top-bar" />
          <div style={{ fontSize: '0.85em', fontWeight: 'bold' }}>
            {getTargetBadgeInfo(activeBatState)}
          </div>
        </div>
      )}

      {/* 7. Run Rates Widget */}
      {layout.run_rates?.visible && (
        <div style={getWidgetStyle(layout.run_rates)} className="premium-panel">
          <div className="neon-top-bar" />
          <div style={{ fontSize: '0.85em', fontWeight: 'bold' }}>
            {getRunRatesInfo(activeBatState)}
          </div>
        </div>
      )}

      {/* 8. Extras Breakdown Widget */}
      {layout.extras_breakdown?.visible && (
        <div style={getWidgetStyle(layout.extras_breakdown)} className="premium-panel">
          <div className="neon-top-bar" />
          <div style={{ fontSize: '0.85em', fontWeight: 'bold' }}>
            {getExtrasBreakdown(activeBatState)}
          </div>
        </div>
      )}

      {/* 9. Match Info Widget */}
      {layout.match_info?.visible && (
        <div style={getWidgetStyle(layout.match_info)} className="premium-panel">
          <div className="neon-top-bar" />
          <div style={{ fontSize: '0.85em', fontWeight: 'bold' }}>
            {getMatchInfo(activeBatState)}
          </div>
        </div>
      )}
    </div>
  );
}

