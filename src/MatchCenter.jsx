import React, { useState, useEffect } from 'react';
import { Trophy, Clock, List, RefreshCw } from 'lucide-react';
import { getSupabaseClient, getSupabaseCredentials } from './supabaseClient';

export default function MatchCenter() {
  const [matchState, setMatchState] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');

  // Parse URL query parameters
  const params = new URLSearchParams(window.location.search);
  const urlMatchId = params.get('matchId');

  // Load initial data and subscribe to changes
  useEffect(() => {
    const supabase = getSupabaseClient();
    const creds = getSupabaseCredentials();
    const matchId = urlMatchId || creds.matchId || 'local';

    // 1. Load initial cache from localStorage
    const localMatchData = localStorage.getItem(`cricdeck_match_${matchId}`);
    if (localMatchData) {
      try {
        setMatchState(JSON.parse(localMatchData));
        setConnectionStatus('Local Sync Active (Offline)');
      } catch (e) {
        console.error('Failed to parse cached local match state:', e);
      }
    }

    // 2. Set up local BroadcastChannel listener for real-time offline sync
    const localChannel = new BroadcastChannel('cricdeck_sync');
    localChannel.onmessage = (event) => {
      console.log('MatchCenter: Received local message:', event.data);
      if (event.data && event.data.type === 'match_update') {
        setMatchState(event.data.state);
        setConnectionStatus('Local Sync Active (Offline)');
      }
    };

    // If no Supabase backend configured or we are in local offline mode
    if (!supabase || matchId === 'local') {
      setConnectionStatus('Local Sync Active (Offline)');
      return () => {
        localChannel.close();
      };
    }

    // 3. Online mode: Fetch match details and score from Supabase
    const fetchSupabaseData = async () => {
      setConnectionStatus('Connecting to Supabase...');
      try {
        const { data: scoreData, error: scoreError } = await supabase
          .from('live_scores')
          .select('*')
          .eq('match_id', matchId)
          .maybeSingle();

        if (scoreError) throw scoreError;

        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .maybeSingle();

        if (matchError) throw matchError;

        // Fetch entire ball ledger to build historical scorecard
        const { data: ledgerData, error: ledgerError } = await supabase
          .from('ball_by_ball')
          .select('*')
          .eq('match_id', matchId)
          .order('delivery_index', { ascending: true });

        if (ledgerError) throw ledgerError;

        if (scoreData && matchData) {
          // Re-map ledger records to delivery_history format
          const formattedHistory = (ledgerData || []).map(ball => ({
            delivery_index: ball.delivery_index,
            over_number: ball.over_number,
            ball_number: ball.ball_number,
            striker_name: ball.striker_name,
            non_striker_name: ball.non_striker_name,
            bowler_name: ball.bowler_name,
            runs_batter: ball.runs_batter,
            runs_extras: ball.runs_extras,
            extra_type: ball.extra_type,
            wicket_type: ball.wicket_type,
            dismissed_batter_name: ball.dismissed_batter_name,
            is_legal: ball.is_legal
          }));

          setMatchState({
            ...matchData,
            ...scoreData,
            striker: typeof scoreData.striker === 'string' ? JSON.parse(scoreData.striker) : (scoreData.striker || { name: '', runs: 0, balls: 0 }),
            non_striker: typeof scoreData.non_striker === 'string' ? JSON.parse(scoreData.non_striker) : (scoreData.non_striker || { name: '', runs: 0, balls: 0 }),
            current_bowler: typeof scoreData.current_bowler === 'string' ? JSON.parse(scoreData.current_bowler) : (scoreData.current_bowler || { name: '', overs: 0, runs: 0, wickets: 0 }),
            current_over_timeline: scoreData.current_over_timeline || [],
            delivery_history: formattedHistory
          });
          setConnectionStatus('Supabase Connected');
        } else {
          setConnectionStatus('No active match data found in Supabase.');
        }
      } catch (err) {
        console.error('MatchCenter: Error loading Supabase data:', err);
        setConnectionStatus(`Sync Error: ${err.message}`);
      }
    };

    fetchSupabaseData();

    // 4. Set up Supabase Realtime Channels
    const scoreChannel = supabase
      .channel(`viewer-scores-${matchId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_scores',
        filter: `match_id=eq.${matchId}`
      }, async (payload) => {
        console.log('MatchCenter: Realtime score update:', payload.new);
        // Re-fetch entire database state to compile complete history scorecard
        fetchSupabaseData();
      })
      .subscribe();

    const matchChannel = supabase
      .channel(`viewer-match-${matchId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${matchId}`
      }, () => {
        fetchSupabaseData();
      })
      .subscribe();

    return () => {
      localChannel.close();
      supabase.removeChannel(scoreChannel);
      supabase.removeChannel(matchChannel);
    };
  }, [urlMatchId]);

  // Compute scorecard variables dynamically
  const buildScorecard = () => {
    if (!matchState) return { batters: {}, bowlers: {}, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 } };

    const batters = {};
    const bowlers = {};
    const extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 };

    const getBatter = (name) => {
      if (!name) return null;
      if (!batters[name]) {
        batters[name] = {
          name,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          howOut: 'Not Out',
          bowler: ''
        };
      }
      return batters[name];
    };

    const getBowler = (name) => {
      if (!name) return null;
      if (!bowlers[name]) {
        bowlers[name] = {
          name,
          balls: 0,
          maidens: 0,
          runs: 0,
          wickets: 0
        };
      }
      return bowlers[name];
    };

    const history = matchState.delivery_history || [];
    history.forEach(ball => {
      const striker = getBatter(ball.striker_name);
      const bowler = getBowler(ball.bowler_name);

      // Force-register non-striker
      getBatter(ball.non_striker_name);

      // 1. Process runs off the bat
      if (striker && ball.runs_batter > 0) {
        striker.runs += ball.runs_batter;
        if (ball.runs_batter === 4) striker.fours += 1;
        if (ball.runs_batter === 6) striker.sixes += 1;
        if (bowler) bowler.runs += ball.runs_batter;
      }

      // 2. Process balls faced
      if (striker && ball.extra_type !== 'wide') {
        striker.balls += 1;
      }

      // 3. Process bowler balls
      if (bowler && ball.is_legal) {
        bowler.balls += 1;
      }

      // 4. Process extras
      if (ball.runs_extras > 0) {
        extras.total += ball.runs_extras;
        if (ball.extra_type === 'wide') {
          extras.wides += ball.runs_extras;
          if (bowler) bowler.runs += ball.runs_extras;
        } else if (ball.extra_type === 'no_ball') {
          extras.noBalls += ball.runs_extras;
          if (bowler) bowler.runs += 1; // NB penalty counts against bowler
        } else if (ball.extra_type === 'bye') {
          extras.byes += ball.runs_extras;
        } else if (ball.extra_type === 'leg_bye') {
          extras.legByes += ball.runs_extras;
        }
      }

      // 5. Process wickets
      if (ball.wicket_type) {
        const dismissed = getBatter(ball.dismissed_batter_name);
        if (dismissed) {
          if (ball.wicket_type === 'bowled') {
            dismissed.howOut = 'b';
            dismissed.bowler = ball.bowler_name;
            if (bowler) bowler.wickets += 1;
          } else if (ball.wicket_type === 'caught') {
            const f = ball.fielder_name || ball.fielderName || (ball.action && ball.action.fielderName);
            dismissed.howOut = f ? `c ${f} b` : 'c';
            dismissed.bowler = ball.bowler_name;
            if (bowler) bowler.wickets += 1;
          } else if (ball.wicket_type === 'caught_behind') {
            const k = ball.keeper_name || ball.keeperName || (ball.action && ball.action.keeperName);
            dismissed.howOut = k ? `c (wk) ${k} b` : 'c (wk) b';
            dismissed.bowler = ball.bowler_name;
            if (bowler) bowler.wickets += 1;
          } else if (ball.wicket_type === 'stumped') {
            const k = ball.keeper_name || ball.keeperName || (ball.action && ball.action.keeperName);
            dismissed.howOut = k ? `st ${k} b` : 'st b';
            dismissed.bowler = ball.bowler_name;
            if (bowler) bowler.wickets += 1;
          } else if (ball.wicket_type === 'lbw') {
            dismissed.howOut = 'lbw b';
            dismissed.bowler = ball.bowler_name;
            if (bowler) bowler.wickets += 1;
          } else {
            dismissed.howOut = 'run out';
          }
        }
      }
    });

    // Merge current live stats to cover active batter/bowler figures
    if (matchState.striker && matchState.striker.name) {
      const liveStriker = getBatter(matchState.striker.name);
      if (liveStriker && liveStriker.balls === 0) {
        liveStriker.runs = matchState.striker.runs || 0;
        liveStriker.balls = matchState.striker.balls || 0;
        liveStriker.fours = matchState.striker.fours || 0;
        liveStriker.sixes = matchState.striker.sixes || 0;
      }
    }
    if (matchState.non_striker && matchState.non_striker.name) {
      const liveNonStriker = getBatter(matchState.non_striker.name);
      if (liveNonStriker && liveNonStriker.balls === 0) {
        liveNonStriker.runs = matchState.non_striker.runs || 0;
        liveNonStriker.balls = matchState.non_striker.balls || 0;
        liveNonStriker.fours = matchState.non_striker.fours || 0;
        liveNonStriker.sixes = matchState.non_striker.sixes || 0;
      }
    }

    // Compute maidens per bowler
    const bowlerOvers = {};
    history.forEach(ball => {
      const bowler = ball.bowler_name;
      const overNum = ball.over_number;
      if (!bowlerOvers[bowler]) bowlerOvers[bowler] = {};
      if (bowlerOvers[bowler][overNum] === undefined) {
        bowlerOvers[bowler][overNum] = { runs: 0, legalBalls: 0 };
      }
      const runsConceded = ball.runs_batter + (ball.extra_type === 'wide' ? ball.runs_extras : (ball.extra_type === 'no_ball' ? 1 : 0));
      bowlerOvers[bowler][overNum].runs += runsConceded;
      if (ball.is_legal) {
        bowlerOvers[bowler][overNum].legalBalls += 1;
      }
    });

    Object.keys(bowlerOvers).forEach(bowlerName => {
      let maidens = 0;
      Object.keys(bowlerOvers[bowlerName]).forEach(overNum => {
        const over = bowlerOvers[bowlerName][overNum];
        if (over.legalBalls >= 6 && over.runs === 0) {
          maidens += 1;
        }
      });
      if (bowlers[bowlerName]) {
        bowlers[bowlerName].maidens = maidens;
      }
    });

    return { batters, bowlers, extras };
  };

  const { batters, bowlers, extras } = buildScorecard();

  // Generate ball-by-ball commentary text
  const generateCommentaryText = (ball) => {
    const bowler = ball.bowler_name.split(' ').pop();
    const batter = ball.striker_name.split(' ').pop();
    
    if (ball.wicket_type) {
      const type = ball.wicket_type.replace(/_/g, ' ');
      if (ball.wicket_type === 'caught') {
        const f = ball.fielder_name || ball.fielderName || (ball.action && ball.action.fielderName) || 'fielder';
        return `OUT! ${batter} is caught by ${f} off the bowling of ${bowler}!`;
      }
      if (ball.wicket_type === 'caught_behind') {
        const k = ball.keeper_name || ball.keeperName || (ball.action && ball.action.keeperName) || 'wicketkeeper';
        return `OUT! Caught behind! ${batter} edges it to ${k} off the bowling of ${bowler}!`;
      }
      if (ball.wicket_type === 'stumped') {
        const k = ball.keeper_name || ball.keeperName || (ball.action && ball.action.keeperName) || 'wicketkeeper';
        return `OUT! Stumped! ${batter} steps out, misses, and ${k} whips the bails off off the bowling of ${bowler}!`;
      }
      return `OUT! ${ball.dismissed_batter_name} is dismissed (${type}) off the bowling of ${bowler}.`;
    }
    
    if (ball.extra_type === 'wide') {
      return `Wide ball. ${bowler} fires it down leg side. Batters run ${ball.runs_extras - 1} additional runs.`;
    }
    
    if (ball.extra_type === 'no_ball') {
      return `No ball! ${bowler} oversteps the crease. Striker scores ${ball.runs_batter} off the free hit.`;
    }

    if (ball.runs_batter === 4) {
      return `FOUR! ${bowler} drops it short, and ${batter} slashes it through cover boundary.`;
    }
    if (ball.runs_batter === 6) {
      return `SIX! High and handsome! ${batter} lofts ${bowler} clean over long-on fence.`;
    }
    if (ball.runs_batter === 0) {
      return `${bowler} to ${batter}, dot ball. Solid defensive block.`;
    }
    
    return `${bowler} to ${batter}, ${ball.runs_batter} run${ball.runs_batter > 1 ? 's' : ''}, nudged into space.`;
  };

  const activeBatState = matchState || {
    team_a: 'Warriors',
    team_b: 'Titans',
    total_runs: 0,
    wickets: 0,
    overs: 0,
    balls_in_over: 0,
    run_rate: 0.00,
    status: 'live',
    current_innings: 1,
    current_over_timeline: [],
    delivery_history: []
  };

  // Helper to format bowler overs (balls to overs decimal conversion)
  const formatBowlerOvers = (ballsCount) => {
    const overs = Math.floor(ballsCount / 6);
    const balls = ballsCount % 6;
    return `${overs}.${balls}`;
  };

  return (
    <div className="viewer-viewport" style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Header Banner */}
      <div className="viewer-header glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Trophy size={32} style={{ color: 'var(--primary)' }} />
            <div>
              <h1 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '800' }}>CricDeck Match Center</h1>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{connectionStatus}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Innings {activeBatState.current_innings} • {activeBatState.status}
            </span>
          </div>
        </div>

        {/* Live Score Block */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              {activeBatState.total_runs}/{activeBatState.wickets}
              <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                ({activeBatState.overs}.{activeBatState.balls_in_over} Overs)
              </span>
            </h2>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <span>Run Rate: <strong style={{ color: '#fff' }}>{activeBatState.run_rate}</strong></span>
              <span>Batting: <strong style={{ color: 'var(--primary)' }}>{activeBatState.team_a}</strong></span>
              <span>Bowling: <strong style={{ color: '#fff' }}>{activeBatState.team_b}</strong></span>
            </div>
          </div>
          {activeBatState.current_over_timeline.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>This Over</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {activeBatState.current_over_timeline.map((ball, i) => {
                  let styleBg = 'rgba(255,255,255,0.05)';
                  let styleColor = '#fff';
                  if (ball === '4') { styleBg = '#0062ff'; }
                  else if (ball === '6') { styleBg = '#8800ff'; }
                  else if (ball === 'W') { styleBg = '#ff003c'; }
                  else if (ball.includes('Wd') || ball.includes('NB')) { styleBg = '#e67300'; }

                  return (
                    <span 
                      key={i} 
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: styleBg,
                        color: styleColor,
                        fontSize: '10px',
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {ball}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Side: Scorecard Tables */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Batting Scorecard */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Batting Scorecard</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeBatState.team_a}</span>
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <th style={{ padding: '8px 4px' }}>Batter</th>
                    <th style={{ padding: '8px 4px' }}>Status</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>R</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>B</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>4s</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>6s</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>SR</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(batters).length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No batting stats recorded yet.</td>
                    </tr>
                  ) : (
                    Object.values(batters).map((batter, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '10px 4px', fontWeight: 'bold' }}>{batter.name}</td>
                        <td style={{ padding: '10px 4px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {batter.howOut === 'Not Out' ? (
                            <span style={{ color: 'var(--primary)' }}>not out</span>
                          ) : (
                            `${batter.howOut} ${batter.bowler}`
                          )}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 'bold' }}>{batter.runs}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', color: 'var(--text-muted)' }}>{batter.balls}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', color: 'var(--text-muted)' }}>{batter.fours}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', color: 'var(--text-muted)' }}>{batter.sixes}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {batter.balls > 0 ? ((batter.runs / batter.balls) * 100).toFixed(1) : '0.0'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Extras Summary */}
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>Extras: <strong>{extras.total}</strong> (wd {extras.wides}, nb {extras.noBalls}, b {extras.byes}, lb {extras.legByes})</span>
              <span>Total Score: <strong>{activeBatState.total_runs}/{activeBatState.wickets}</strong></span>
            </div>
          </div>

          {/* Bowling Scorecard */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Bowling Scorecard</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{activeBatState.team_b}</span>
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <th style={{ padding: '8px 4px' }}>Bowler</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>O</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>M</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>R</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>W</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(bowlers).length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No bowling stats recorded yet.</td>
                    </tr>
                  ) : (
                    Object.values(bowlers).map((bowler, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '10px 4px', fontWeight: 'bold' }}>{bowler.name}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right' }}>{formatBowlerOvers(bowler.balls)}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right' }}>{bowler.maidens || 0}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right' }}>{bowler.runs}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>{bowler.wickets}</td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {bowler.balls > 0 ? ((bowler.runs / (bowler.balls / 6))).toFixed(2) : '0.00'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Timeline Commentary Feed */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '600px', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={18} style={{ color: 'var(--primary)' }} />
            <span>Live Commentary</span>
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeBatState.delivery_history && activeBatState.delivery_history.length > 0 ? (
              [...activeBatState.delivery_history].reverse().map((ball, idx) => {
                let ballLabelClass = 'comm-ball-dot';
                if (ball.runs_batter === 4) ballLabelClass = 'comm-ball-four';
                else if (ball.runs_batter === 6) ballLabelClass = 'comm-ball-six';
                else if (ball.wicket_type) ballLabelClass = 'comm-ball-wicket';
                else if (ball.extra_type) ballLabelClass = 'comm-ball-extra';

                return (
                  <div key={idx} style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span className="timeline-ball-index" style={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {ball.over_number}.{ball.ball_number}
                      </span>
                      <span className={`commentary-ball-label ${ballLabelClass}`} style={{
                        marginTop: '4px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {ball.wicket_type ? 'W' : (ball.extra_type === 'wide' ? 'Wd' : (ball.extra_type === 'no_ball' ? 'Nb' : ball.runs_batter))}
                      </span>
                    </div>
                    <div style={{ flex: 1, fontSize: '0.85rem', lineHeight: 1.4 }}>
                      <p style={{ margin: 0 }}>{generateCommentaryText(ball)}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Waiting for the first delivery to be bowled...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
