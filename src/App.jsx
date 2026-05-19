import React, { useState, useEffect } from 'react';
import { 
  Trophy, Settings, RotateCcw, Plus, Trash2, 
  HelpCircle, User, Zap, RefreshCw, Layers, ArrowLeft, CheckCircle
} from 'lucide-react';
import { 
  processDelivery, 
  undoDelivery, 
  calculateRunRate, 
  rotateStrike 
} from './scoringLogic';
import { 
  getSupabaseClient, 
  getSupabaseCredentials, 
  saveSupabaseCredentials, 
  resetSupabaseClient 
} from './supabaseClient';
import OverlayEditor from './OverlayEditor';
import BroadcastView from './BroadcastView';
import MatchCenter from './MatchCenter';
import LandingPage from './LandingPage';
import TournamentSetup from './TournamentSetup';
import TournamentDashboard from './TournamentDashboard';

const INITIAL_MATCH_STATE = {
  team_a: 'Team A',
  team_b: 'Team B',
  toss_winner: '',
  elected_to: 'Bat',
  current_innings: 1,
  status: 'live',
  total_runs: 0,
  wickets: 0,
  overs: 0,
  balls_in_over: 0,
  run_rate: 0.0,
  striker: { name: '', runs: 0, balls: 0, fours: 0, sixes: 0 },
  non_striker: { name: '', runs: 0, balls: 0, fours: 0, sixes: 0 },
  current_bowler: { name: '', overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 },
  current_over_timeline: [],
  delivery_history: [],
  
  // Tournament details
  tournament_id: null,
  team_a_id: null,
  team_b_id: null,
  innings1_score: null,
  innings1_wickets: null,
  innings1_overs: null,
  innings1_balls: null,
  winner_id: null
};

function App() {
  const [matchState, setMatchState] = useState(null);
  const [showSetup, setShowSetup] = useState(true);
  const [dbConfig, setDbConfig] = useState({ url: '', key: '', matchId: '' });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExtrasModal, setShowExtrasModal] = useState(false);
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [showBowlerModal, setShowBowlerModal] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'overlay', or 'viewer'
  const [isBroadcast, setIsBroadcast] = useState(false);
  const [isViewer, setIsViewer] = useState(false);

  // Tournament States
  const [viewRoute, setViewRoute] = useState('landing'); // landing, setup_tournament, tournament_dashboard, scorer
  const [tournaments, setTournaments] = useState(() => {
    const saved = localStorage.getItem('cricdeck_tournaments');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTournamentId, setActiveTournamentId] = useState(() => {
    return localStorage.getItem('cricdeck_active_tournament_id') || '';
  });

  // Innings 2 Setup Modal for Tournament matches
  const [showInnings2Modal, setShowInnings2Modal] = useState(false);
  const [inn2Striker, setInn2Striker] = useState('');
  const [inn2NonStriker, setInn2NonStriker] = useState('');
  const [inn2Bowler, setInn2Bowler] = useState('');

  // Pre-Match Setup Modal states
  const [showPreMatchModal, setShowPreMatchModal] = useState(false);
  const [preMatchConfigMatch, setPreMatchConfigMatch] = useState(null);
  const [tossWinnerId, setTossWinnerId] = useState('');
  const [electedTo, setElectedTo] = useState('Bat');
  const [preStriker, setPreStriker] = useState('');
  const [preNonStriker, setPreNonStriker] = useState('');
  const [preBowler, setPreBowler] = useState('');

  // Setup inputs for single match
  const [setupData, setSetupData] = useState({
    team_a: 'Warriors',
    team_b: 'Titans',
    toss_winner: 'Warriors',
    elected_to: 'Bat',
    striker_name: 'David Warner',
    non_striker_name: 'Steven Smith',
    bowler_name: 'Mitchell Starc'
  });

  // Extras modal state
  const [extraType, setExtraType] = useState('WIDE'); // WIDE or NO_BALL
  const [extraRuns, setExtraRuns] = useState(0);
  const [extraRunType, setExtraRunType] = useState('bat'); // 'bat' or 'byes' or 'leg_byes'

  // Wicket modal state
  const [wicketType, setWicketType] = useState('bowled');
  const [dismissedBatter, setDismissedBatter] = useState('');
  const [newBatterName, setNewBatterName] = useState('');
  const [runsCompleted, setRunsCompleted] = useState(0);
  const [fielderName, setFielderName] = useState('');
  const [keeperName, setKeeperName] = useState('');

  // New bowler modal state
  const [nextBowlerName, setNextBowlerName] = useState('');

  // Load state and DB settings on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('broadcast') === 'true') {
      setIsBroadcast(true);
      return;
    }
    if (params.get('viewer') === 'true') {
      setIsViewer(true);
      return;
    }

    // Supabase config
    const creds = getSupabaseCredentials();
    setDbConfig({
      url: creds.url || '',
      key: creds.key || '',
      matchId: creds.matchId || ''
    });

    // Local match state
    const savedState = localStorage.getItem('cricdeck_match_state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setMatchState(parsed);
        setShowSetup(false);
        setViewRoute('scorer'); // resume scoring
      } catch (e) {
        console.error('Failed to parse saved match state', e);
      }
    }
  }, []);

  // Save active tournament ID changes
  useEffect(() => {
    if (activeTournamentId) {
      localStorage.setItem('cricdeck_active_tournament_id', activeTournamentId);
    } else {
      localStorage.removeItem('cricdeck_active_tournament_id');
    }
  }, [activeTournamentId]);

  // Save match state to localStorage and broadcast sync events on changes
  useEffect(() => {
    if (matchState) {
      localStorage.setItem('cricdeck_match_state', JSON.stringify(matchState));
      const creds = getSupabaseCredentials();
      const matchId = creds.matchId || 'local';
      localStorage.setItem(`cricdeck_match_${matchId}`, JSON.stringify(matchState));
      
      // If this belongs to a tournament, update it in the tournament matches list
      if (matchState.tournament_id) {
        setTournaments(prevTournaments => {
          const updated = prevTournaments.map(t => {
            if (t.id === matchState.tournament_id) {
              const updatedMatches = (t.matches || []).map(m => {
                if (m.id === matchState.id) {
                  return {
                    ...m,
                    team_a_score: matchState.innings1_score !== null ? matchState.innings1_score : matchState.total_runs,
                    team_a_wickets: matchState.innings1_wickets !== null ? matchState.innings1_wickets : matchState.wickets,
                    team_a_overs: matchState.innings1_overs !== null ? matchState.innings1_overs : matchState.overs,
                    team_a_balls: matchState.innings1_balls !== null ? matchState.innings1_balls : matchState.balls_in_over,
                    team_b_score: matchState.current_innings === 2 ? matchState.total_runs : 0,
                    team_b_wickets: matchState.current_innings === 2 ? matchState.wickets : 0,
                    team_b_overs: matchState.current_innings === 2 ? matchState.overs : 0,
                    team_b_balls: matchState.current_innings === 2 ? matchState.balls_in_over : 0,
                    status: matchState.status,
                    delivery_history: matchState.delivery_history,
                    winner_id: matchState.winner_id
                  };
                }
                return m;
              });
              return { ...t, matches: updatedMatches };
            }
            return t;
          });
          localStorage.setItem('cricdeck_tournaments', JSON.stringify(updated));
          return updated;
        });
      }

      const channel = new BroadcastChannel('cricdeck_sync');
      channel.postMessage({ type: 'match_update', state: matchState });
      channel.close();
    } else {
      localStorage.removeItem('cricdeck_match_state');
    }
  }, [matchState]);

  // Helper: get available squad batters
  const getAvailableBatters = () => {
    if (!matchState || !matchState.tournament_id) return [];
    const activeTournament = tournaments.find(t => t.id === matchState.tournament_id);
    const battingTeamId = matchState.current_innings === 1 ? matchState.team_a_id : matchState.team_b_id;
    const teamObj = activeTournament?.teams.find(t => t.id === battingTeamId);
    if (!teamObj) return [];

    // Find who has already been dismissed in this innings
    const dismissedNames = matchState.delivery_history
      .filter(ball => ball.wicket_type && ball.dismissed_batter_name && ball.innings === matchState.current_innings)
      .map(ball => ball.dismissed_batter_name);

    return teamObj.players.filter(p => 
      p.name !== matchState.striker.name && 
      p.name !== matchState.non_striker.name &&
      !dismissedNames.includes(p.name)
    );
  };

  // Helper: get available squad bowlers
  const getAvailableBowlers = () => {
    if (!matchState || !matchState.tournament_id) return [];
    const activeTournament = tournaments.find(t => t.id === matchState.tournament_id);
    const bowlingTeamId = matchState.current_innings === 1 ? matchState.team_b_id : matchState.team_a_id;
    const teamObj = activeTournament?.teams.find(t => t.id === bowlingTeamId);
    if (!teamObj) return [];

    const lastBowler = matchState.current_bowler.name;
    return teamObj.players.filter(p => p.name !== lastBowler);
  };

  // Sync state to Supabase
  const syncToSupabase = async (state, actionInfo = null) => {
    const supabase = getSupabaseClient();
    const creds = getSupabaseCredentials();
    if (!supabase || !creds.matchId) return;

    try {
      if (actionInfo?.type === 'UNDO') {
        const nextDeliveryIndex = state.delivery_history.length;
        await supabase
          .from('ball_by_ball')
          .delete()
          .eq('match_id', creds.matchId)
          .eq('delivery_index', nextDeliveryIndex);
      } else if (actionInfo?.type === 'DELIVERY' && state.delivery_history.length > 0) {
        const last = state.delivery_history[state.delivery_history.length - 1];
        await supabase.from('ball_by_ball').upsert({
          match_id: creds.matchId,
          delivery_index: last.delivery_index,
          over_number: last.over_number,
          ball_number: last.ball_number,
          striker_name: last.striker_name,
          non_striker_name: last.non_striker_name,
          bowler_name: last.bowler_name,
          runs_batter: last.runs_batter,
          runs_extras: last.runs_extras,
          extra_type: last.extra_type,
          wicket_type: last.wicket_type,
          dismissed_batter_name: last.dismissed_batter_name,
          is_legal: last.is_legal
        });
      }

      await supabase.from('live_scores').upsert({
        match_id: creds.matchId,
        total_runs: state.total_runs,
        wickets: state.wickets,
        overs: state.overs,
        balls_in_over: state.balls_in_over,
        run_rate: state.run_rate,
        striker_stats: state.striker,
        non_striker_stats: state.non_striker,
        current_bowler_stats: state.current_bowler
      });

      await supabase.from('matches').update({
        current_innings: state.current_innings,
        status: state.status
      }).eq('id', creds.matchId);

    } catch (e) {
      console.error('Supabase sync error:', e);
    }
  };

  const handleStartMatch = (e) => {
    e.preventDefault();
    const initialState = {
      ...INITIAL_MATCH_STATE,
      team_a: setupData.team_a,
      team_b: setupData.team_b,
      toss_winner: setupData.toss_winner,
      elected_to: setupData.elected_to,
      striker: { name: setupData.striker_name, runs: 0, balls: 0, fours: 0, sixes: 0 },
      non_striker: { name: setupData.non_striker_name, runs: 0, balls: 0, fours: 0, sixes: 0 },
      current_bowler: { name: setupData.bowler_name, overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 }
    };

    setMatchState(initialState);
    setShowSetup(false);
    setViewRoute('scorer');
    syncToSupabase(initialState);
  };

  const handleRunsClick = (runs) => {
    if (!matchState) return;
    const action = { type: 'RUNS', value: runs };
    applyAction(action);
  };

  const handleExtrasClick = (type) => {
    setExtraType(type);
    setExtraRuns(0);
    setExtraRunType('bat');
    setShowExtrasModal(true);
  };

  const submitExtra = () => {
    if (!matchState) return;
    const action = { 
      type: extraType, 
      additionalRuns: parseInt(extraRuns) || 0,
      runType: extraType === 'NO_BALL' ? extraRunType : 'runs'
    };
    applyAction(action);
    setShowExtrasModal(false);
  };

  const getBatterPhoto = (playerName) => {
    if (!matchState?.tournament_id) return null;
    const activeTournament = tournaments.find(t => t.id === matchState.tournament_id);
    if (!activeTournament) return null;
    for (const team of activeTournament.teams) {
      const player = team.players.find(p => p.name === playerName);
      if (player && player.photo_data) {
        return player.photo_data;
      }
    }
    return null;
  };

  const getFieldingTeamPlayers = () => {
    if (!matchState?.tournament_id) return [];
    const activeTournament = tournaments.find(t => t.id === matchState.tournament_id);
    if (!activeTournament) return [];
    const bowlerName = matchState.current_bowler.name;
    for (const team of activeTournament.teams) {
      if (team.players.some(p => p.name === bowlerName)) {
        return team.players;
      }
    }
    const strikerName = matchState.striker.name;
    const otherTeam = activeTournament.teams.find(team => !team.players.some(p => p.name === strikerName));
    return otherTeam ? otherTeam.players : [];
  };

  const handleWicketClick = () => {
    if (!matchState) return;
    setWicketType('bowled');
    setDismissedBatter(matchState.striker.name);
    setNewBatterName('');
    setRunsCompleted(0);
    setFielderName('');
    setKeeperName('');
    setShowWicketModal(true);
  };

  const submitWicket = () => {
    if (!matchState || !newBatterName.trim()) return;
    
    if (wicketType === 'caught' && !fielderName.trim()) {
      alert('Please specify who took the catch.');
      return;
    }
    if ((wicketType === 'stumped' || wicketType === 'caught_behind') && !keeperName.trim()) {
      alert('Please specify the Wicketkeeper.');
      return;
    }

    const action = {
      type: 'WICKET',
      wicketType,
      dismissedBatterName: dismissedBatter,
      newBatterName: newBatterName.trim(),
      runsCompleted: parseInt(runsCompleted) || 0,
      fielderName: wicketType === 'caught' ? fielderName.trim() : null,
      keeperName: (wicketType === 'stumped' || wicketType === 'caught_behind') ? keeperName.trim() : null
    };
    applyAction(action);
    setShowWicketModal(false);
  };

  const handleUndo = () => {
    if (!matchState || matchState.delivery_history.length === 0) return;
    const undone = undoDelivery(matchState);
    setMatchState(undone);
    syncToSupabase(undone, { type: 'UNDO' });
  };

  const applyAction = (action) => {
    const nextState = processDelivery(matchState, action);
    const isOverComplete = nextState.balls_in_over === 0 && (
      action.type === 'RUNS' || 
      action.type === 'BYES' || 
      action.type === 'LEG_BYES' || 
      (action.type === 'WICKET' && action.wicketType !== 'run_out_wide' && action.wicketType !== 'run_out_noball')
    );
    
    setMatchState(nextState);
    syncToSupabase(nextState, { type: 'DELIVERY' });

    if (isOverComplete) {
      setNextBowlerName('');
      setShowBowlerModal(true);
    }
  };

  const submitBowlerChange = () => {
    if (!matchState || !nextBowlerName.trim()) return;
    
    setMatchState(prev => {
      const updated = {
        ...prev,
        current_bowler: {
          name: nextBowlerName.trim(),
          overs: 0,
          balls: 0,
          runs: 0,
          wickets: 0,
          maidens: 0
        },
        current_over_timeline: []
      };
      syncToSupabase(updated);
      return updated;
    });

    setShowBowlerModal(false);
  };

  const handleSwapStrike = () => {
    if (!matchState) return;
    const rotated = rotateStrike(matchState);
    setMatchState(rotated);
    syncToSupabase(rotated);
  };

  const handleEndInnings = () => {
    if (!matchState) return;
    if (matchState.current_innings === 1) {
      if (matchState.tournament_id) {
        // Tournament match: open the selection modal for Innings 2
        setInn2Striker('');
        setInn2NonStriker('');
        setInn2Bowler('');
        setShowInnings2Modal(true);
      } else {
        if (window.confirm('End 1st Innings? Strike and innings will be rotated.')) {
          const nextState = {
            ...matchState,
            current_innings: 2,
            total_runs: 0,
            wickets: 0,
            overs: 0,
            balls_in_over: 0,
            run_rate: 0.00,
            striker: { name: 'Batter 1 (Inn 2)', runs: 0, balls: 0, fours: 0, sixes: 0 },
            non_striker: { name: 'Batter 2 (Inn 2)', runs: 0, balls: 0, fours: 0, sixes: 0 },
            current_bowler: { name: 'Bowler 1 (Inn 2)', overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 },
            current_over_timeline: [],
            delivery_history: matchState.delivery_history
          };
          setMatchState(nextState);
          syncToSupabase(nextState);
        }
      }
    }
  };

  const submitInnings2Start = (e) => {
    e.preventDefault();
    if (!inn2Striker || !inn2NonStriker || !inn2Bowler) {
      alert('Please select all starting players for Innings 2.');
      return;
    }
    if (inn2Striker === inn2NonStriker) {
      alert('Striker and Non-Striker must be different players.');
      return;
    }

    const nextState = {
      ...matchState,
      innings1_score: matchState.total_runs,
      innings1_wickets: matchState.wickets,
      innings1_overs: matchState.overs,
      innings1_balls: matchState.balls_in_over,

      current_innings: 2,
      total_runs: 0,
      wickets: 0,
      overs: 0,
      balls_in_over: 0,
      run_rate: 0.00,
      striker: { name: inn2Striker, runs: 0, balls: 0, fours: 0, sixes: 0 },
      non_striker: { name: inn2NonStriker, runs: 0, balls: 0, fours: 0, sixes: 0 },
      current_bowler: { name: inn2Bowler, overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 },
      current_over_timeline: [],
      delivery_history: matchState.delivery_history
    };

    setMatchState(nextState);
    setShowInnings2Modal(false);
    syncToSupabase(nextState);
  };

  const handleFinishMatch = () => {
    if (!matchState) return;
    if (window.confirm('Finish Match? Final scores and NRR will be updated.')) {
      let winner_id = null;
      if (matchState.tournament_id && matchState.innings1_score !== null) {
        const scoreA = matchState.innings1_score;
        const scoreB = matchState.total_runs;
        if (scoreA > scoreB) winner_id = matchState.team_a_id;
        else if (scoreB > scoreA) winner_id = matchState.team_b_id;
      }

      const nextState = {
        ...matchState,
        status: 'completed',
        winner_id
      };

      setMatchState(nextState);
      syncToSupabase(nextState);
      
      // Delay navigation slightly to let state save completes
      setTimeout(() => {
        setMatchState(null);
        if (matchState.tournament_id) {
          setViewRoute('tournament_dashboard');
        } else {
          setViewRoute('landing');
        }
      }, 300);
    }
  };

  // Tournament Setup Complete
  const handleTournamentSetupComplete = (tournamentData) => {
    const newTournament = {
      id: Math.random().toString(),
      name: tournamentData.name,
      format: tournamentData.format,
      overs_quota: tournamentData.overs_quota,
      teams: tournamentData.teams,
      matches: []
    };

    const updated = [...tournaments, newTournament];
    setTournaments(updated);
    localStorage.setItem('cricdeck_tournaments', JSON.stringify(updated));
    
    setActiveTournamentId(newTournament.id);
    setViewRoute('tournament_dashboard');
  };

  // Schedule Match
  const handleScheduleMatch = (matchData) => {
    const activeTournament = tournaments.find(t => t.id === activeTournamentId);
    if (!activeTournament) return;

    const newMatch = {
      id: Math.random().toString(),
      tournament_id: activeTournament.id,
      team_a_id: matchData.team_a_id,
      team_b_id: matchData.team_b_id,
      team_a: matchData.team_a,
      team_b: matchData.team_b,
      match_date: matchData.match_date,
      overs_quota: matchData.overs_quota,
      status: 'scheduled',
      team_a_score: 0,
      team_a_wickets: 0,
      team_a_overs: 0,
      team_a_balls: 0,
      team_b_score: 0,
      team_b_wickets: 0,
      team_b_overs: 0,
      team_b_balls: 0,
      delivery_history: []
    };

    setTournaments(prev => {
      const updated = prev.map(t => {
        if (t.id === activeTournamentId) {
          return {
            ...t,
            matches: [...(t.matches || []), newMatch]
          };
        }
        return t;
      });
      localStorage.setItem('cricdeck_tournaments', JSON.stringify(updated));
      return updated;
    });
  };

  // Update scheduled match date
  const handleUpdateMatchDate = (matchId, newDate) => {
    setTournaments(prev => {
      const updated = prev.map(t => {
        if (t.id === activeTournamentId) {
          const updatedMatches = (t.matches || []).map(m => {
            if (m.id === matchId) {
              return { ...m, match_date: newDate };
            }
            return m;
          });
          return { ...t, matches: updatedMatches };
        }
        return t;
      });
      localStorage.setItem('cricdeck_tournaments', JSON.stringify(updated));
      return updated;
    });
  };

  // Get dynamic teams info for the pre-match wizard setup
  const getPreMatchTeamsInfo = () => {
    if (!preMatchConfigMatch) return { battingTeam: null, bowlingTeam: null, battingTeamPlayers: [], bowlingTeamPlayers: [] };
    
    const activeTournament = tournaments.find(t => t.id === activeTournamentId);
    if (!activeTournament) return { battingTeam: null, bowlingTeam: null, battingTeamPlayers: [], bowlingTeamPlayers: [] };

    const { team_a_id, team_b_id } = preMatchConfigMatch;
    const teamA = activeTournament.teams.find(t => t.id === team_a_id);
    const teamB = activeTournament.teams.find(t => t.id === team_b_id);

    let battingTeam, bowlingTeam;
    if (tossWinnerId === team_a_id) {
      if (electedTo === 'Bat') {
        battingTeam = teamA;
        bowlingTeam = teamB;
      } else {
        battingTeam = teamB;
        bowlingTeam = teamA;
      }
    } else {
      if (electedTo === 'Bat') {
        battingTeam = teamB;
        bowlingTeam = teamA;
      } else {
        battingTeam = teamA;
        bowlingTeam = teamB;
      }
    }

    return {
      battingTeam,
      bowlingTeam,
      battingTeamPlayers: battingTeam?.players || [],
      bowlingTeamPlayers: bowlingTeam?.players || []
    };
  };

  // Pre-match lineup submission
  const handlePreMatchSubmit = (e) => {
    e.preventDefault();
    if (!preStriker || !preNonStriker || !preBowler) {
      alert('Please select starting batsmen and bowler.');
      return;
    }
    if (preStriker === preNonStriker) {
      alert('Striker and Non-Striker must be different.');
      return;
    }

    const { battingTeam, bowlingTeam } = getPreMatchTeamsInfo();
    const tossWinnerObj = tournaments.find(t => t.id === activeTournamentId)
      ?.teams.find(t => t.id === tossWinnerId);

    const targetState = {
      ...INITIAL_MATCH_STATE,
      id: preMatchConfigMatch.id,
      tournament_id: preMatchConfigMatch.tournament_id,
      team_a_id: battingTeam.id,
      team_b_id: bowlingTeam.id,
      team_a: battingTeam.name,
      team_b: bowlingTeam.name,
      toss_winner: tossWinnerObj?.name || '',
      elected_to: electedTo,
      status: 'live',
      overs_quota: preMatchConfigMatch.overs_quota,
      striker: { name: preStriker, runs: 0, balls: 0, fours: 0, sixes: 0 },
      non_striker: { name: preNonStriker, runs: 0, balls: 0, fours: 0, sixes: 0 },
      current_bowler: { name: preBowler, overs: 0, balls: 0, runs: 0, wickets: 0, maidens: 0 }
    };

    setMatchState(targetState);
    setShowPreMatchModal(false);
    setViewRoute('scorer');

    // Save Supabase config
    const creds = getSupabaseCredentials();
    saveSupabaseCredentials({
      ...creds,
      matchId: preMatchConfigMatch.id
    });
  };

  // Start scoring scheduled match
  const handleStartScoringMatch = (match) => {
    const activeTournament = tournaments.find(t => t.id === activeTournamentId);
    
    // Check if resuming a live match or starting a scheduled one
    if (match.status === 'live') {
      const savedMatchDetails = localStorage.getItem(`cricdeck_match_${match.id}`);
      if (savedMatchDetails) {
        setMatchState(JSON.parse(savedMatchDetails));
        setViewRoute('scorer');
        return;
      }
    }

    // It's a scheduled match: open the Pre-Match Setup Wizard/Modal!
    setPreMatchConfigMatch(match);
    setTossWinnerId(match.team_a_id);
    setElectedTo('Bat');
    
    // Auto-select starting players
    const teamAObj = activeTournament.teams.find(t => t.id === match.team_a_id);
    const teamBObj = activeTournament.teams.find(t => t.id === match.team_b_id);
    
    setPreStriker(teamAObj?.players[0]?.name || '');
    setPreNonStriker(teamAObj?.players[1]?.name || '');
    setPreBowler(teamBObj?.players[0]?.name || '');
    
    setShowPreMatchModal(true);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    saveSupabaseCredentials(dbConfig);
    resetSupabaseClient();
    setShowSettingsModal(false);
  };

  const handleClearSettings = () => {
    saveSupabaseCredentials({ url: '', key: '', matchId: '' });
    resetSupabaseClient();
    setDbConfig({ url: '', key: '', matchId: '' });
    setShowSettingsModal(false);
  };

  const getRecentMatches = () => {
    return tournaments.reduce((acc, t) => acc.concat(t.matches || []), []);
  };

  const isSupabaseConfigured = dbConfig.url && dbConfig.key && dbConfig.matchId;

  const renderSettingsModal = () => (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Supabase Backend Connection</h3>
        </div>
        <form onSubmit={handleSaveSettings}>
          <div className="modal-body">
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Enter your Supabase credentials to enable real-time scoring sync.
              Leave empty to operate in local mock mode.
            </p>
            <div className="form-group">
              <label>Supabase URL</label>
              <input 
                type="url" 
                className="form-control" 
                value={dbConfig.url} 
                onChange={e => setDbConfig({...dbConfig, url: e.target.value})}
                placeholder="https://your-project.supabase.co"
              />
            </div>
            <div className="form-group">
              <label>Supabase Anon Key</label>
              <input 
                type="password" 
                className="form-control" 
                value={dbConfig.key} 
                onChange={e => setDbConfig({...dbConfig, key: e.target.value})}
                placeholder="your-anon-key"
              />
            </div>
            <div className="form-group">
              <label>Match ID</label>
              <input 
                type="text" 
                className="form-control" 
                value={dbConfig.matchId} 
                onChange={e => setDbConfig({...dbConfig, matchId: e.target.value})}
                placeholder="custom-match-uuid-or-id"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClearSettings}>
              Clear & Local Mode
            </button>
            <button type="submit" className="btn btn-primary">
              Save Credentials
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Broadcaster check short circuit
  if (isBroadcast) {
    return <BroadcastView />;
  }

  // Spectator check short circuit
  if (isViewer) {
    return <MatchCenter />;
  }

  // Route Views

  if (viewRoute === 'landing') {
    return (
      <div className="app-container">
        <header className="app-header glass-panel">
          <div className="brand">
            <Trophy className="brand-icon" size={28} />
            <h1>CricDeck</h1>
          </div>

          <div className="header-actions">
            <div 
              className="status-badge"
              onClick={() => setShowSettingsModal(true)}
              title="Click to configure Supabase"
            >
              <span className={`status-dot ${isSupabaseConfigured ? 'online' : 'offline'}`} />
              <span>{isSupabaseConfigured ? 'Sync Live' : 'Local Mock'}</span>
              <Settings size={16} style={{ marginLeft: '0.25rem' }} />
            </div>
          </div>
        </header>

        <LandingPage 
          tournaments={tournaments}
          recentMatches={getRecentMatches()}
          onStartNewTournament={() => setViewRoute('setup_tournament')}
          onSelectTournament={(id) => {
            setActiveTournamentId(id);
            setViewRoute('tournament_dashboard');
          }}
        />

        {showSettingsModal && renderSettingsModal()}
      </div>
    );
  }

  if (viewRoute === 'setup_tournament') {
    return (
      <div className="app-container">
        <header className="app-header glass-panel">
          <div className="brand">
            <Trophy className="brand-icon" size={28} />
            <h1>CricDeck</h1>
          </div>
        </header>

        <TournamentSetup 
          onComplete={handleTournamentSetupComplete}
          onCancel={() => setViewRoute('landing')}
        />
      </div>
    );
  }

  if (viewRoute === 'tournament_dashboard') {
    const tournament = tournaments.find(t => t.id === activeTournamentId);
    return (
      <div className="app-container">
        <header className="app-header glass-panel">
          <div className="brand">
            <Trophy className="brand-icon" size={28} />
            <h1>CricDeck</h1>
          </div>

          <div className="header-actions">
            <div 
              className="status-badge"
              onClick={() => setShowSettingsModal(true)}
              title="Click to configure Supabase"
            >
              <span className={`status-dot ${isSupabaseConfigured ? 'online' : 'offline'}`} />
              <span>{isSupabaseConfigured ? 'Sync Live' : 'Local Mock'}</span>
              <Settings size={16} style={{ marginLeft: '0.25rem' }} />
            </div>
          </div>
        </header>

        {tournament && (
          <TournamentDashboard 
            tournament={tournament}
            matches={tournament.matches || []}
            onStartScoringMatch={handleStartScoringMatch}
            onScheduleMatch={handleScheduleMatch}
            onUpdateMatchDate={handleUpdateMatchDate}
            onBackToLanding={() => setViewRoute('landing')}
            onDesignOverlay={() => setViewRoute('overlay_editor')}
          />
        )}

        {showSettingsModal && renderSettingsModal()}
      </div>
    );
  }

  // Overlay Editor Route
  if (viewRoute === 'overlay_editor') {
    return (
      <OverlayEditor 
        matchState={matchState} 
        onBack={() => {
          if (matchState && matchState.status === 'live') {
            setViewRoute('scorer');
          } else if (activeTournamentId) {
            setViewRoute('tournament_dashboard');
          } else {
            setViewRoute('landing');
          }
        }}
      />
    );
  }

  // Active Live Scorer Route
  if (viewRoute === 'scorer' && matchState) {
    return (
      <div className="app-container">
        {/* Header */}
        <header className="app-header glass-panel">
          <div className="brand" onClick={() => {
            if (matchState.tournament_id) {
              setViewRoute('tournament_dashboard');
            } else {
              setViewRoute('landing');
            }
          }} style={{ cursor: 'pointer' }}>
            <ArrowLeft className="brand-icon" size={24} />
            <h1>Scoring Dashboard</h1>
          </div>

          <nav className="header-tabs">
            <button 
              className={`header-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Scorer Dashboard
            </button>
            <button 
              className="header-tab-btn"
              onClick={() => setViewRoute('overlay_editor')}
            >
              Overlay Editor
            </button>
            <button 
              className={`header-tab-btn ${activeTab === 'viewer' ? 'active' : ''}`}
              onClick={() => setActiveTab('viewer')}
            >
              Match Center
            </button>
          </nav>

          <div className="header-actions">
            <div 
              className="status-badge"
              onClick={() => setShowSettingsModal(true)}
              title="Click to configure Supabase"
            >
              <span className={`status-dot ${isSupabaseConfigured ? 'online' : 'offline'}`} />
              <span>{isSupabaseConfigured ? 'Sync Live' : 'Local Mock'}</span>
              <Settings size={16} style={{ marginLeft: '0.25rem' }} />
            </div>
          </div>
        </header>

        {/* Scorer Dashboard Tab Panel */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-grid">
            {/* Scoring panel */}
            <div className="main-column">
              
              {/* Live Scorecard */}
              <div className="scorecard-panel glass-panel">
                <div className="scorecard-main">
                  <div className="score-display">
                    <div className="match-teams">
                      {matchState.team_a} vs {matchState.team_b}
                    </div>
                    <div className="runs-wickets">
                      {matchState.total_runs}<span>/</span>{matchState.wickets}
                      <span className="overs-display">
                        ({matchState.overs}.{matchState.balls_in_over} Overs)
                      </span>
                    </div>
                  </div>
                  <div className="runrate-display">
                    <span className="rr-label">Run Rate</span>
                    <span className="rr-value">{matchState.run_rate.toFixed(2)}</span>
                  </div>
                </div>
                <div className="match-meta-bar">
                  <span className="meta-item">
                    Innings: <strong>{matchState.current_innings === 1 ? '1st Innings' : '2nd Innings'}</strong>
                  </span>
                  <span className="meta-item">
                    Toss: <strong>{matchState.toss_winner} ({matchState.elected_to} First)</strong>
                  </span>
                  <span className="meta-item">
                    Status: <strong style={{ color: matchState.status === 'live' ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {matchState.status.toUpperCase()}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Players Area */}
              <div className="players-panel">
                
                {/* Batter Stats */}
                <div className="batters-card glass-panel">
                  <div className="section-title">
                    <User size={16} /> Active Batters
                  </div>
                  <table className="batters-table">
                    <thead>
                      <tr>
                        <th>Batter</th>
                        <th className="stat-cell-header">R</th>
                        <th className="stat-cell-header">B</th>
                        <th className="stat-cell-header">4s</th>
                        <th className="stat-cell-header">6s</th>
                        <th className="stat-cell-header">SR</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="batter-row active">
                        <td className="batter-name-cell">
                          <span className="strike-dot" />
                          {matchState.striker.name}
                        </td>
                        <td className="stat-cell">{matchState.striker.runs}</td>
                        <td className="stat-cell">{matchState.striker.balls}</td>
                        <td className="stat-cell">{matchState.striker.fours}</td>
                        <td className="stat-cell">{matchState.striker.sixes}</td>
                        <td className="stat-cell">
                          {matchState.striker.balls > 0 
                            ? ((matchState.striker.runs / matchState.striker.balls) * 100).toFixed(1)
                            : '0.0'
                          }
                        </td>
                      </tr>
                      <tr className="batter-row">
                        <td className="batter-name-cell">
                          <span className="strike-dot" style={{ opacity: 0 }} />
                          {matchState.non_striker.name}
                        </td>
                        <td className="stat-cell">{matchState.non_striker.runs}</td>
                        <td className="stat-cell">{matchState.non_striker.balls}</td>
                        <td className="stat-cell">{matchState.non_striker.fours}</td>
                        <td className="stat-cell">{matchState.non_striker.sixes}</td>
                        <td className="stat-cell">
                          {matchState.non_striker.balls > 0 
                            ? ((matchState.non_striker.runs / matchState.non_striker.balls) * 100).toFixed(1)
                            : '0.0'
                          }
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleSwapStrike}
                    style={{ width: '100%', marginTop: '1rem', padding: '0.5rem' }}
                  >
                    <RefreshCw size={14} /> Swap Strike
                  </button>
                </div>

                {/* Bowler Stats */}
                <div className="bowler-card glass-panel">
                  <div className="section-title">
                    <Layers size={16} /> Current Bowler
                  </div>
                  <div className="bowler-stat-row">
                    <div className="bowler-header">
                      <span className="bowler-name">{matchState.current_bowler.name}</span>
                    </div>
                    <div className="bowler-grid">
                      <div className="bowler-stat-item">
                        <span className="bowler-stat-val">
                          {matchState.current_bowler.overs}.{matchState.current_bowler.balls}
                        </span>
                        <span className="bowler-stat-lbl">Overs</span>
                      </div>
                      <div className="bowler-stat-item">
                        <span className="bowler-stat-val">
                          {matchState.current_bowler.maidens}
                        </span>
                        <span className="bowler-stat-lbl">Mdn</span>
                      </div>
                      <div className="bowler-stat-item">
                        <span className="bowler-stat-val">
                          {matchState.current_bowler.runs}
                        </span>
                        <span className="bowler-stat-lbl">Runs</span>
                      </div>
                      <div className="bowler-stat-item">
                        <span className="bowler-stat-val">
                          {matchState.current_bowler.wickets}
                        </span>
                        <span className="bowler-stat-lbl">Wkts</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Economy: {((matchState.current_bowler.overs * 6 + matchState.current_bowler.balls) > 0)
                        ? ((matchState.current_bowler.runs / (matchState.current_bowler.overs * 6 + matchState.current_bowler.balls)) * 6).toFixed(2)
                        : '0.00'
                      }
                    </div>
                  </div>
                </div>

              </div>

              {/* Current Over Timeline */}
              <div className="timeline-panel glass-panel">
                <div className="section-title">
                  Current Over
                </div>
                <div className="timeline-balls">
                  {matchState.current_over_timeline.length === 0 ? (
                    <span style={{ color: 'var(--text-dark)', fontSize: '0.9rem' }}>No balls bowled yet in this over.</span>
                  ) : (
                    matchState.current_over_timeline.map((ball, i) => {
                      let ballClass = '';
                      if (ball === '4') ballClass = 'runs-4';
                      else if (ball === '6') ballClass = 'runs-6';
                      else if (ball === 'W') ballClass = 'wicket';
                      else if (ball.includes('Wd') || ball.includes('NB') || ball.includes('B') || ball.includes('LB')) ballClass = 'extra';

                      return (
                        <div key={i} className={`timeline-ball ${ballClass}`}>
                          {ball}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Scoring Inputs */}
              <div className="controls-panel glass-panel">
                <div className="controls-row">
                  <span className="section-title">Runs (Off Bat)</span>
                  <div className="grid-runs">
                    <button className="btn-runs" onClick={() => handleRunsClick(0)}>0</button>
                    <button className="btn-runs" onClick={() => handleRunsClick(1)}>1</button>
                    <button className="btn-runs" onClick={() => handleRunsClick(2)}>2</button>
                    <button className="btn-runs" onClick={() => handleRunsClick(3)}>3</button>
                    <button className="btn-runs boundary-4" onClick={() => handleRunsClick(4)}>4</button>
                    <button className="btn-runs boundary-6" onClick={() => handleRunsClick(6)}>6</button>
                  </div>
                </div>

                <div className="controls-row">
                  <span className="section-title">Extras</span>
                  <div className="grid-extras">
                    <button className="btn-extras" onClick={() => handleExtrasClick('WIDE')}>WIDE</button>
                    <button className="btn-extras" onClick={() => handleExtrasClick('NO_BALL')}>NO BALL</button>
                    <button className="btn-extras" onClick={() => applyAction({ type: 'BYES', runsCompleted: 1 })}>1 BYE</button>
                    <button className="btn-extras" onClick={() => applyAction({ type: 'LEG_BYES', runsCompleted: 1 })}>1 LEG BYE</button>
                  </div>
                </div>

                <div className="grid-ops">
                  <button className="btn-wicket-large" onClick={handleWicketClick}>
                    WICKET
                  </button>
                  <button 
                    className="btn btn-secondary btn-icon" 
                    onClick={handleUndo} 
                    disabled={matchState.delivery_history.length === 0}
                    style={{ opacity: matchState.delivery_history.length === 0 ? 0.5 : 1 }}
                    title="Undo last delivery"
                  >
                    <RotateCcw size={16} /> Undo
                  </button>
                </div>
              </div>

              {/* Action Buttons to Switch Innings / Complete Match */}
              <div className="scorer-footer-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                {matchState.current_innings === 1 && (
                  <button className="btn btn-warning w-full" onClick={handleEndInnings}>
                    End 1st Innings
                  </button>
                )}
                
                <button className="btn btn-success w-full" onClick={handleFinishMatch}>
                  <CheckCircle size={16} /> Complete Match
                </button>
              </div>
            </div>

            {/* Delivery ledger log */}
            <div className="ledger-panel glass-panel">
              <div className="section-title">
                Match Delivery Ledger
              </div>
              <div className="ledger-list">
                {matchState.delivery_history.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-dark)', padding: '2rem 0' }}>
                    <HelpCircle size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                    <p style={{ fontSize: '0.85rem' }}>Ledger is empty.<br />Start scoring to fill.</p>
                  </div>
                ) : (
                  [...matchState.delivery_history].reverse().map((entry, i) => (
                    <div key={i} className="ledger-item">
                      <div className="ledger-details">
                        <span className="ledger-main-text">
                          {entry.striker_name} faced {entry.bowler_name}
                        </span>
                        <span className="ledger-sub-text">
                          Inn: {entry.innings || 1} | Over: {entry.over_number}.{entry.ball_number} | Runs: {entry.runs_batter + entry.runs_extras}
                          {entry.wicket_type && ` | Wkt: ${entry.wicket_type.toUpperCase()}`}
                        </span>
                      </div>
                      <div className={`ledger-badge ${entry.extra_type ? entry.extra_type : (entry.wicket_type ? 'w' : '')}`}>
                        {entry.wicket_type 
                          ? 'W' 
                          : (entry.extra_type 
                            ? entry.extra_type.toUpperCase() 
                            : entry.runs_batter
                          )
                        }
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'viewer' && (
          <MatchCenter />
        )}

        {/* Settings Modal (Supabase Config) */}
        {showSettingsModal && renderSettingsModal()}

        {/* Extras Modal */}
        {showExtrasModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Score {extraType} Delivery</h3>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Additional Runs Run (Not including the 1 penalty run)</label>
                  <div className="option-grid">
                    {[0, 1, 2, 3, 4, 6].map(num => (
                      <button 
                        key={num}
                        type="button" 
                        className={`option-btn ${extraRuns === num ? 'active' : ''}`}
                        onClick={() => setExtraRuns(num)}
                      >
                        {num} Runs
                      </button>
                    ))}
                  </div>
                </div>

                {extraType === 'NO_BALL' && (
                  <div className="form-group">
                    <label>Runs Type</label>
                    <select 
                      className="form-control select-control" 
                      value={extraRunType}
                      onChange={e => setExtraRunType(e.target.value)}
                    >
                      <option value="bat">Off the Bat (Runs credited to Batter)</option>
                      <option value="byes">Byes (Recorded as extras)</option>
                      <option value="leg_byes">Leg Byes (Recorded as extras)</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowExtrasModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={submitExtra}>
                  Apply Delivery
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Wicket Modal */}
        {showWicketModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Dismissal Details</h3>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Dismissal Type</label>
                  <select 
                    className="form-control select-control" 
                    value={wicketType}
                    onChange={e => setWicketType(e.target.value)}
                  >
                    <option value="bowled">Bowled</option>
                    <option value="caught">Caught (Fielder)</option>
                    <option value="caught_behind">Caught Behind (Keeper)</option>
                    <option value="lbw">LBW</option>
                    <option value="stumped">Stumped (Keeper)</option>
                    <option value="run_out">Run Out (Legal ball)</option>
                    <option value="run_out_wide">Run Out (on Wide ball)</option>
                    <option value="run_out_noball">Run Out (on No Ball)</option>
                    <option value="retired_hurt">Retired Hurt</option>
                  </select>
                </div>

                {/* Who is Out? interactive cards popup section */}
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold' }}>Who is Out?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    
                    {/* Striker card */}
                    <div 
                      onClick={() => setDismissedBatter(matchState.striker.name)}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: dismissedBatter === matchState.striker.name ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                        background: dismissedBatter === matchState.striker.name ? 'rgba(236, 72, 153, 0.12)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: dismissedBatter === matchState.striker.name ? '0 0 10px rgba(236, 72, 153, 0.3)' : 'none'
                      }}
                    >
                      {getBatterPhoto(matchState.striker.name) ? (
                        <img 
                          src={getBatterPhoto(matchState.striker.name)} 
                          alt="Striker" 
                          style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }} 
                        />
                      ) : (
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                          {matchState.striker.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem', wordBreak: 'break-word' }}>{matchState.striker.name}</span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Striker</span>
                      
                      <div style={{
                        marginTop: '4px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: '2px solid ' + (dismissedBatter === matchState.striker.name ? 'var(--primary)' : 'rgba(255,255,255,0.3)'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: dismissedBatter === matchState.striker.name ? 'var(--primary)' : 'transparent'
                      }}>
                        {dismissedBatter === matchState.striker.name && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                      </div>
                    </div>

                    {/* Non-Striker card */}
                    <div 
                      onClick={() => setDismissedBatter(matchState.non_striker.name)}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: dismissedBatter === matchState.non_striker.name ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                        background: dismissedBatter === matchState.non_striker.name ? 'rgba(236, 72, 153, 0.12)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: dismissedBatter === matchState.non_striker.name ? '0 0 10px rgba(236, 72, 153, 0.3)' : 'none'
                      }}
                    >
                      {getBatterPhoto(matchState.non_striker.name) ? (
                        <img 
                          src={getBatterPhoto(matchState.non_striker.name)} 
                          alt="Non-Striker" 
                          style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)' }} 
                        />
                      ) : (
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                          {matchState.non_striker.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem', wordBreak: 'break-word' }}>{matchState.non_striker.name}</span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Non-Striker</span>
                      
                      <div style={{
                        marginTop: '4px',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: '2px solid ' + (dismissedBatter === matchState.non_striker.name ? 'var(--primary)' : 'rgba(255,255,255,0.3)'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: dismissedBatter === matchState.non_striker.name ? 'var(--primary)' : 'transparent'
                      }}>
                        {dismissedBatter === matchState.non_striker.name && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Who caught it field (for Caught Wickets) */}
                {wicketType === 'caught' && (
                  <div className="form-group animate-fade-in" style={{ marginBottom: '1rem' }}>
                    <label>Who took the catch?</label>
                    {matchState.tournament_id && getFieldingTeamPlayers().length > 0 ? (
                      <select 
                        className="form-control select-control"
                        value={fielderName}
                        onChange={e => setFielderName(e.target.value)}
                        required
                      >
                        <option value="">-- Select Fielder --</option>
                        {getFieldingTeamPlayers().map(p => (
                          <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        className="form-control"
                        value={fielderName}
                        onChange={e => setFielderName(e.target.value)}
                        placeholder="Enter fielder's name"
                        required
                      />
                    )}
                  </div>
                )}

                {/* Wicketkeeper Name field (for Stumped or Caught Behind Wickets) */}
                {(wicketType === 'stumped' || wicketType === 'caught_behind') && (
                  <div className="form-group animate-fade-in" style={{ marginBottom: '1rem' }}>
                    <label>Wicketkeeper Name</label>
                    {matchState.tournament_id && getFieldingTeamPlayers().length > 0 ? (
                      <select 
                        className="form-control select-control"
                        value={keeperName}
                        onChange={e => setKeeperName(e.target.value)}
                        required
                      >
                        <option value="">-- Select Keeper --</option>
                        {getFieldingTeamPlayers().map(p => (
                          <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        className="form-control"
                        value={keeperName}
                        onChange={e => setKeeperName(e.target.value)}
                        placeholder="Enter Wicketkeeper's name"
                        required
                      />
                    )}
                  </div>
                )}

                {(wicketType === 'run_out' || wicketType === 'run_out_wide' || wicketType === 'run_out_noball') && (
                  <div className="form-group">
                    <label>Runs Completed Before Run Out</label>
                    <input 
                      type="number" 
                      min="0"
                      max="6"
                      className="form-control" 
                      value={runsCompleted}
                      onChange={e => setRunsCompleted(parseInt(e.target.value) || 0)}
                    />
                  </div>
                )}

                {/* Squad Roster smart dropdown selection */}
                {matchState.tournament_id ? (
                  <div className="form-group">
                    <label>Select Incoming Batter</label>
                    <select 
                      className="form-control select-control"
                      value={newBatterName}
                      onChange={e => setNewBatterName(e.target.value)}
                      required
                    >
                      <option value="">-- Select Batter --</option>
                      {getAvailableBatters().map(p => (
                        <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>New Batter Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={newBatterName}
                      onChange={e => setNewBatterName(e.target.value)}
                      placeholder="Enter incoming batter's name"
                      required
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowWicketModal(false)}>
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={submitWicket}
                  disabled={!newBatterName.trim()}
                >
                  Apply Wicket
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bowler Change Modal */}
        {showBowlerModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Over Complete!</h3>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  6 legal deliveries bowled. Please change the bowler. Note: Strike rotation has been applied automatically.
                </p>

                {/* Squad Roster smart dropdown selection */}
                {matchState.tournament_id ? (
                  <div className="form-group">
                    <label>Select Incoming Bowler</label>
                    <select 
                      className="form-control select-control"
                      value={nextBowlerName}
                      onChange={e => setNextBowlerName(e.target.value)}
                      required
                    >
                      <option value="">-- Select Bowler --</option>
                      {getAvailableBowlers().map(p => (
                        <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Incoming Bowler Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={nextBowlerName}
                      onChange={e => setNextBowlerName(e.target.value)}
                      placeholder="Enter next bowler's name"
                      required
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  className="btn btn-primary" 
                  onClick={submitBowlerChange}
                  disabled={!nextBowlerName.trim()}
                >
                  Start Next Over
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INNINGS 2 SETUP MODAL FOR TOURNAMENT MATCHES */}
        {showInnings2Modal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '550px' }}>
              <div className="modal-header">
                <h3>Innings 2 Lineup Setup</h3>
              </div>
              
              <form onSubmit={submitInnings2Start}>
                <div className="modal-body">
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)' }}>
                    {matchState.team_a} scored {matchState.total_runs}/{matchState.wickets}. 
                    Now {matchState.team_b} will bat. Select the opening lineup.
                  </p>

                  <div className="form-group">
                    <label>Opening Batter 1 (Striker)</label>
                    <select 
                      className="form-control select-control"
                      value={inn2Striker}
                      onChange={e => setInn2Striker(e.target.value)}
                      required
                    >
                      <option value="">-- Select Batter --</option>
                      {tournaments.find(t => t.id === matchState.tournament_id)
                        ?.teams.find(t => t.id === matchState.team_b_id)
                        ?.players.map(p => (
                          <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Opening Batter 2 (Non-Striker)</label>
                    <select 
                      className="form-control select-control"
                      value={inn2NonStriker}
                      onChange={e => setInn2NonStriker(e.target.value)}
                      required
                    >
                      <option value="">-- Select Batter --</option>
                      {tournaments.find(t => t.id === matchState.tournament_id)
                        ?.teams.find(t => t.id === matchState.team_b_id)
                        ?.players.map(p => (
                          <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                        ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Opening Bowler</label>
                    <select 
                      className="form-control select-control"
                      value={inn2Bowler}
                      onChange={e => setInn2Bowler(e.target.value)}
                      required
                    >
                      <option value="">-- Select Bowler --</option>
                      {tournaments.find(t => t.id === matchState.tournament_id)
                        ?.teams.find(t => t.id === matchState.team_a_id)
                        ?.players.map(p => (
                          <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="submit" className="btn btn-primary">
                    Start Innings 2
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PRE-MATCH SETUP MODAL */}
        {showPreMatchModal && (() => {
          const { battingTeam, bowlingTeam, battingTeamPlayers, bowlingTeamPlayers } = getPreMatchTeamsInfo();

          return (
            <div className="modal-overlay">
              <div className="modal-content" style={{ maxWidth: '550px' }}>
                <div className="modal-header">
                  <h3>Pre-Match Toss & Lineup Setup</h3>
                  <button className="btn-close" onClick={() => setShowPreMatchModal(false)}>&times;</button>
                </div>
                
                <form onSubmit={handlePreMatchSubmit}>
                  <div className="modal-body">
                    {/* Toss Winner */}
                    <div className="form-group">
                      <label>Who won the toss?</label>
                      <select 
                        className="form-control select-control"
                        value={tossWinnerId}
                        onChange={e => {
                          const wId = e.target.value;
                          setTossWinnerId(wId);
                          // Auto reset starting players based on new batting/bowling team assignments
                          const activeTournament = tournaments.find(t => t.id === activeTournamentId);
                          const teamA = activeTournament?.teams.find(t => t.id === preMatchConfigMatch.team_a_id);
                          const teamB = activeTournament?.teams.find(t => t.id === preMatchConfigMatch.team_b_id);
                          
                          let newBattingTeam, newBowlingTeam;
                          if (wId === preMatchConfigMatch.team_a_id) {
                            newBattingTeam = electedTo === 'Bat' ? teamA : teamB;
                            newBowlingTeam = electedTo === 'Bat' ? teamB : teamA;
                          } else {
                            newBattingTeam = electedTo === 'Bat' ? teamB : teamA;
                            newBowlingTeam = electedTo === 'Bat' ? teamA : teamB;
                          }
                          setPreStriker(newBattingTeam?.players[0]?.name || '');
                          setPreNonStriker(newBattingTeam?.players[1]?.name || '');
                          setPreBowler(newBowlingTeam?.players[0]?.name || '');
                        }}
                        required
                      >
                        <option value={preMatchConfigMatch?.team_a_id}>{preMatchConfigMatch?.team_a}</option>
                        <option value={preMatchConfigMatch?.team_b_id}>{preMatchConfigMatch?.team_b}</option>
                      </select>
                    </div>

                    {/* Elected To */}
                    <div className="form-group">
                      <label>Elected to?</label>
                      <select 
                        className="form-control select-control"
                        value={electedTo}
                        onChange={e => {
                          const val = e.target.value;
                          setElectedTo(val);
                          // Auto reset starting players
                          const activeTournament = tournaments.find(t => t.id === activeTournamentId);
                          const teamA = activeTournament?.teams.find(t => t.id === preMatchConfigMatch.team_a_id);
                          const teamB = activeTournament?.teams.find(t => t.id === preMatchConfigMatch.team_b_id);
                          
                          let newBattingTeam, newBowlingTeam;
                          if (tossWinnerId === preMatchConfigMatch.team_a_id) {
                            newBattingTeam = val === 'Bat' ? teamA : teamB;
                            newBowlingTeam = val === 'Bat' ? teamB : teamA;
                          } else {
                            newBattingTeam = val === 'Bat' ? teamB : teamA;
                            newBowlingTeam = val === 'Bat' ? teamA : teamB;
                          }
                          setPreStriker(newBattingTeam?.players[0]?.name || '');
                          setPreNonStriker(newBattingTeam?.players[1]?.name || '');
                          setPreBowler(newBowlingTeam?.players[0]?.name || '');
                        }}
                        required
                      >
                        <option value="Bat">Bat First</option>
                        <option value="Bowl">Bowl First</option>
                      </select>
                    </div>

                    <h4 style={{ margin: '1.5rem 0 0.5rem 0', color: 'var(--text-light)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.25rem' }}>
                      Opening Lineups ({battingTeam?.name} batting, {bowlingTeam?.name} bowling)
                    </h4>

                    {/* Striker */}
                    <div className="form-group">
                      <label>Opening Batter 1 (Striker)</label>
                      <select 
                        className="form-control select-control"
                        value={preStriker}
                        onChange={e => setPreStriker(e.target.value)}
                        required
                      >
                        <option value="">-- Select Batter --</option>
                        {battingTeamPlayers.map(p => (
                          <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                        ))}
                      </select>
                    </div>

                    {/* Non-Striker */}
                    <div className="form-group">
                      <label>Opening Batter 2 (Non-Striker)</label>
                      <select 
                        className="form-control select-control"
                        value={preNonStriker}
                        onChange={e => setPreNonStriker(e.target.value)}
                        required
                      >
                        <option value="">-- Select Batter --</option>
                        {battingTeamPlayers.map(p => (
                          <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                        ))}
                      </select>
                    </div>

                    {/* Bowler */}
                    <div className="form-group">
                      <label>Opening Bowler</label>
                      <select 
                        className="form-control select-control"
                        value={preBowler}
                        onChange={e => setPreBowler(e.target.value)}
                        required
                      >
                        <option value="">-- Select Bowler --</option>
                        {bowlingTeamPlayers.map(p => (
                          <option key={p.id} value={p.name}>{p.name} ({p.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowPreMatchModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Start Match
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return null;
}

export default App;
