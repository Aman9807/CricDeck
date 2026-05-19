/**
 * Converts overs and balls into a true decimal representation (e.g. 3.2 overs -> 3.333 overs)
 */
export function oversToDecimal(overs, balls) {
  return overs + (balls / 6);
}

/**
 * Computes tournament standings (Points, Wins, Losses, NRR) for all teams
 */
export function calculateStandings(teams, matches) {
  const standings = {};

  // Initialize
  teams.forEach(team => {
    standings[team.id] = {
      id: team.id,
      name: team.name,
      logo_data: team.logo_data,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
      runsScored: 0,
      oversFaced: 0,
      runsConceded: 0,
      oversBowled: 0,
      nrr: 0.00
    };
  });

  matches.forEach(match => {
    if (match.status !== 'completed') return;

    const teamA = standings[match.team_a_id];
    const teamB = standings[match.team_b_id];
    if (!teamA || !teamB) return;

    teamA.played += 1;
    teamB.played += 1;

    // Determine winner/loser
    if (match.winner_id === match.team_a_id) {
      teamA.won += 1;
      teamA.points += 2;
      teamB.lost += 1;
    } else if (match.winner_id === match.team_b_id) {
      teamB.won += 1;
      teamB.points += 2;
      teamA.lost += 1;
    } else {
      teamA.tied += 1;
      teamA.points += 1;
      teamB.tied += 1;
      teamB.points += 1;
    }

    const quota = match.overs_quota || 20;

    // Team A batting stats (Team A scored, Team B conceded)
    const runsA = match.team_a_score || 0;
    const wicketsA = match.team_a_wickets || 0;
    const oversFacedA = wicketsA === 10 ? quota : oversToDecimal(match.team_a_overs || 0, match.team_a_balls || 0);

    teamA.runsScored += runsA;
    teamA.oversFaced += oversFacedA;
    teamB.runsConceded += runsA;
    teamB.oversBowled += oversFacedA;

    // Team B batting stats (Team B scored, Team A conceded)
    const runsB = match.team_b_score || 0;
    const wicketsB = match.team_b_wickets || 0;
    const oversFacedB = wicketsB === 10 ? quota : oversToDecimal(match.team_b_overs || 0, match.team_b_balls || 0);

    teamB.runsScored += runsB;
    teamB.oversFaced += oversFacedB;
    teamA.runsConceded += runsB;
    teamA.oversBowled += oversFacedB;
  });

  // Calculate final NRR
  Object.keys(standings).forEach(id => {
    const team = standings[id];
    const rateScored = team.oversFaced > 0 ? (team.runsScored / team.oversFaced) : 0;
    const rateConceded = team.oversBowled > 0 ? (team.runsConceded / team.oversBowled) : 0;
    team.nrr = rateScored - rateConceded;
  });

  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
}

/**
 * Computes individual player stats across all tournament matches
 */
export function calculatePlayerLeaderboards(players, matches) {
  const stats = {};

  // Initialize
  players.forEach(p => {
    stats[p.name] = {
      name: p.name,
      team_id: p.team_id,
      photo_data: p.photo_data,
      role: p.role,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      dismissed: 0,
      wickets: 0,
      ballsBowled: 0,
      maidens: 0,
      runsConceded: 0,
      strikeRate: 0,
      economy: 99.99,
      impactScore: 0,
      wicketHattricks: 0,
      sixesHattricks: 0,
      foursHattricks: 0
    };
  });

  matches.forEach(match => {
    // We only parse scores from completed or live matches that have delivery history
    const history = match.delivery_history || [];
    
    // Track unique overs per bowler in this match for maiden calculations
    const bowlerMatchOvers = {}; // { [bowler]: { [overNum]: { runs: 0, legalBalls: 0 } } }

    // Track sequential actions for hat-tricks in this match
    const batterRunsSequence = {}; // { [batterName]: [] }
    const bowlerWicketsSequence = {}; // { [bowlerName]: [] }

    history.forEach(ball => {
      const striker = stats[ball.striker_name];
      const bowler = stats[ball.bowler_name];

      // 1. Batting runs
      if (striker && ball.runs_batter > 0) {
        striker.runs += ball.runs_batter;
        if (ball.runs_batter === 4) striker.fours += 1;
        if (ball.runs_batter === 6) striker.sixes += 1;
        if (bowler) bowler.runsConceded += ball.runs_batter;
      }

      // 2. Batting balls faced & sequence for boundaries hat-trick
      if (striker && ball.extra_type !== 'wide') {
        striker.balls += 1;
        if (!batterRunsSequence[ball.striker_name]) batterRunsSequence[ball.striker_name] = [];
        batterRunsSequence[ball.striker_name].push(ball.runs_batter);
      }

      // 3. Bowling balls
      if (bowler && ball.is_legal) {
        bowler.ballsBowled += 1;
      }

      // 4. Bowling runs conceded
      if (ball.runs_extras > 0 && bowler) {
        if (ball.extra_type === 'wide') {
          bowler.runsConceded += ball.runs_extras;
        } else if (ball.extra_type === 'no_ball') {
          bowler.runsConceded += 1;
        }
      }

      // 5. Maidens tracker
      if (bowler) {
        const overNum = ball.over_number;
        const bName = ball.bowler_name;
        if (!bowlerMatchOvers[bName]) bowlerMatchOvers[bName] = {};
        if (!bowlerMatchOvers[bName][overNum]) {
          bowlerMatchOvers[bName][overNum] = { runs: 0, legalBalls: 0 };
        }
        
        const runsOnBall = ball.runs_batter + (ball.extra_type === 'wide' ? ball.runs_extras : (ball.extra_type === 'no_ball' ? 1 : 0));
        bowlerMatchOvers[bName][overNum].runs += runsOnBall;
        if (ball.is_legal) {
          bowlerMatchOvers[bName][overNum].legalBalls += 1;
        }
      }

      // 6. Dismissals & wickets
      if (ball.wicket_type) {
        const dismissed = stats[ball.dismissed_batter_name];
        if (dismissed) dismissed.dismissed += 1;

        const isBowlerWkt = ball.wicket_type !== 'run_out' && ball.wicket_type !== 'run_out_wide' && ball.wicket_type !== 'run_out_noball' && ball.wicket_type !== 'retired_hurt';
        if (isBowlerWkt && bowler) {
          bowler.wickets += 1;
        }
        
        if (bowler) {
          if (!bowlerWicketsSequence[ball.bowler_name]) bowlerWicketsSequence[ball.bowler_name] = [];
          bowlerWicketsSequence[ball.bowler_name].push(isBowlerWkt);
        }
      } else {
        if (bowler) {
          if (!bowlerWicketsSequence[ball.bowler_name]) bowlerWicketsSequence[ball.bowler_name] = [];
          bowlerWicketsSequence[ball.bowler_name].push(false);
        }
      }
    });

    // Compute batter boundary hat-tricks for this match
    Object.keys(batterRunsSequence).forEach(name => {
      const seq = batterRunsSequence[name];
      let sixesStreak = 0;
      let foursStreak = 0;
      let sixHattricks = 0;
      let fourHattricks = 0;

      for (let i = 0; i < seq.length; i++) {
        if (seq[i] === 6) {
          sixesStreak++;
          if (sixesStreak >= 3) {
            sixHattricks++;
            sixesStreak = 0; // count non-overlapping hat-tricks
          }
        } else {
          sixesStreak = 0;
        }

        if (seq[i] === 4) {
          foursStreak++;
          if (foursStreak >= 3) {
            fourHattricks++;
            foursStreak = 0; // count non-overlapping hat-tricks
          }
        } else {
          foursStreak = 0;
        }
      }

      if (stats[name]) {
        stats[name].sixesHattricks += sixHattricks;
        stats[name].foursHattricks += fourHattricks;
      }
    });

    // Compute bowler wicket hat-tricks for this match
    Object.keys(bowlerWicketsSequence).forEach(name => {
      const seq = bowlerWicketsSequence[name];
      let wktStreak = 0;
      let wktHattricks = 0;

      for (let i = 0; i < seq.length; i++) {
        if (seq[i] === true) {
          wktStreak++;
          if (wktStreak >= 3) {
            wktHattricks++;
            wktStreak = 0;
          }
        } else {
          wktStreak = 0;
        }
      }

      if (stats[name]) {
        stats[name].wicketHattricks += wktHattricks;
      }
    });

    // Count maidens in this match and add to bowler stats
    Object.keys(bowlerMatchOvers).forEach(bName => {
      let maidens = 0;
      Object.keys(bowlerMatchOvers[bName]).forEach(overNum => {
        const over = bowlerMatchOvers[bName][overNum];
        if (over.legalBalls >= 6 && over.runs === 0) {
          maidens += 1;
        }
      });
      if (stats[bName]) {
        stats[bName].maidens += maidens;
      }
    });
  });

  // Calculate averages, SR, economy, and impact scores
  Object.keys(stats).forEach(name => {
    const p = stats[name];
    
    // Strike Rate
    p.strikeRate = p.balls > 0 ? parseFloat(((p.runs / p.balls) * 100).toFixed(1)) : 0;
    
    // Economy
    p.economy = p.ballsBowled > 0 ? parseFloat((p.runsConceded / (p.ballsBowled / 6)).toFixed(2)) : 0;

    // Player impact scoring
    // Runs (1pt), strike rate factor (0.05), wickets (25pts), maidens (10pts), economy penalty (-2pts per econ run)
    const batImpact = (p.runs * 1.0) + (p.strikeRate * 0.05);
    const bowlImpact = (p.wickets * 25) + (p.maidens * 10) - (p.ballsBowled > 0 ? p.economy * 2 : 0);
    p.impactScore = parseFloat((batImpact + bowlImpact).toFixed(2));
  });

  const list = Object.values(stats);
  return {
    topRunScorers: [...list].filter(p => p.runs > 0).sort((a, b) => b.runs - a.runs),
    topWicketTakers: [...list].filter(p => p.wickets > 0).sort((a, b) => b.wickets - a.wickets),
    bestEconomies: [...list].filter(p => p.ballsBowled >= 6).sort((a, b) => a.economy - b.economy),
    boundaryKings: [...list].filter(p => (p.fours + p.sixes) > 0).sort((a, b) => (b.fours + b.sixes) - (a.fours + a.sixes)),
    allPlayers: list.sort((a, b) => b.impactScore - a.impactScore)
  };
}

/**
 * Computes individual player ratings for a single match to suggest Player of the Match
 */
export function calculateMatchAwards(match) {
  const history = match.delivery_history || [];
  const playerStats = {};

  const getPlayer = (name) => {
    if (!playerStats[name]) {
      playerStats[name] = {
        name,
        runs: 0,
        balls: 0,
        wickets: 0,
        runsConceded: 0,
        ballsBowled: 0,
        maidens: 0,
        economy: 0
      };
    }
    return playerStats[name];
  };

  const bowlerMatchOvers = {};

  history.forEach(ball => {
    const striker = getPlayer(ball.striker_name);
    getPlayer(ball.non_striker_name);
    const bowler = getPlayer(ball.bowler_name);

    if (ball.runs_batter > 0) {
      striker.runs += ball.runs_batter;
      bowler.runsConceded += ball.runs_batter;
    }
    if (ball.extra_type !== 'wide') {
      striker.balls += 1;
    }
    if (ball.is_legal) {
      bowler.ballsBowled += 1;
    }
    if (ball.runs_extras > 0) {
      if (ball.extra_type === 'wide') {
        bowler.runsConceded += ball.runs_extras;
      } else if (ball.extra_type === 'no_ball') {
        bowler.runsConceded += 1;
      }
    }
    if (ball.wicket_type) {
      if (ball.wicket_type !== 'run_out' && ball.wicket_type !== 'run_out_wide' && ball.wicket_type !== 'run_out_noball') {
        bowler.wickets += 1;
      }
    }

    const overNum = ball.over_number;
    const bName = ball.bowler_name;
    if (!bowlerMatchOvers[bName]) bowlerMatchOvers[bName] = {};
    if (!bowlerMatchOvers[bName][overNum]) {
      bowlerMatchOvers[bName][overNum] = { runs: 0, legalBalls: 0 };
    }
    const runsOnBall = ball.runs_batter + (ball.extra_type === 'wide' ? ball.runs_extras : (ball.extra_type === 'no_ball' ? 1 : 0));
    bowlerMatchOvers[bName][overNum].runs += runsOnBall;
    if (ball.is_legal) {
      bowlerMatchOvers[bName][overNum].legalBalls += 1;
    }
  });

  // Calculate maidens
  Object.keys(bowlerMatchOvers).forEach(bName => {
    let maidens = 0;
    Object.keys(bowlerMatchOvers[bName]).forEach(overNum => {
      const over = bowlerMatchOvers[bName][overNum];
      if (over.legalBalls >= 6 && over.runs === 0) {
        maidens += 1;
      }
    });
    if (playerStats[bName]) {
      playerStats[bName].maidens = maidens;
    }
  });

  const list = Object.values(playerStats).map(p => {
    const strikeRate = p.balls > 0 ? (p.runs / p.balls) * 100 : 0;
    const economy = p.ballsBowled > 0 ? p.runsConceded / (p.ballsBowled / 6) : 0;
    
    const batImpact = (p.runs * 1.0) + (strikeRate * 0.05);
    const bowlImpact = (p.wickets * 25) + (p.maidens * 10) - (p.ballsBowled > 0 ? economy * 2 : 0);
    const impactScore = parseFloat((batImpact + bowlImpact).toFixed(2));

    return {
      name: p.name,
      runs: p.runs,
      balls: p.balls,
      wickets: p.wickets,
      impactScore
    };
  });

  return list.sort((a, b) => b.impactScore - a.impactScore);
}
