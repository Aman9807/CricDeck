// CricDeck Core Cricket Scoring Logic

/**
 * Rotates strike between striker and non-striker
 */
export function rotateStrike(state) {
  return {
    ...state,
    striker: { ...state.non_striker },
    non_striker: { ...state.striker }
  };
}

/**
 * Formats overs to float format, e.g. 1 over and 2 balls => 1.2
 */
export function formatOvers(overs, balls) {
  return parseFloat(`${overs}.${balls}`);
}

/**
 * Calculates current run rate
 */
export function calculateRunRate(runs, overs, balls) {
  const totalBalls = overs * 6 + balls;
  if (totalBalls === 0) return 0.00;
  return parseFloat(((runs / totalBalls) * 6).toFixed(2));
}

/**
 * Process a delivery action and return the updated match state
 * @param {Object} state - Current match state
 * @param {Object} action - Scoring action (e.g. RUNS, WIDE, NO_BALL, etc.)
 */
export function processDelivery(state, action) {
  // Create deep copy of state to avoid mutations
  let newState = JSON.parse(JSON.stringify(state));
  let isLegal = true;
  let runsAdded = 0;
  let extrasAdded = 0;
  let timelineLabel = '';

  switch (action.type) {
    case 'RUNS': {
      const runs = action.value;
      runsAdded = runs;
      isLegal = true;
      timelineLabel = runs === 0 ? '•' : `${runs}`;

      // Update Batter stats
      newState.striker.runs += runs;
      newState.striker.balls += 1;
      if (runs === 4) newState.striker.fours += 1;
      if (runs === 6) newState.striker.sixes += 1;

      // Update Bowler stats
      newState.current_bowler.runs += runs;

      // Rotate strike on odd runs
      if (runs % 2 !== 0) {
        newState = rotateStrike(newState);
      }
      break;
    }

    case 'WIDE': {
      const additionalRuns = action.additionalRuns || 0; // runs run by batters
      extrasAdded = 1 + additionalRuns;
      runsAdded = extrasAdded;
      isLegal = false;
      timelineLabel = additionalRuns > 0 ? `Wd+${additionalRuns}` : 'Wd';

      // Wides do NOT count as balls faced by batter
      // Bowler is penalized for the wide penalty + additional runs run on it
      newState.current_bowler.runs += (1 + additionalRuns);

      // Rotate strike on odd additional runs
      if (additionalRuns % 2 !== 0) {
        newState = rotateStrike(newState);
      }
      break;
    }

    case 'NO_BALL': {
      const additionalRuns = action.additionalRuns || 0;
      const runType = action.runType || 'bat'; // 'bat' or 'byes' or 'leg_byes'
      isLegal = false;
      
      // No ball adds 1 penalty run automatically
      extrasAdded = 1; 
      
      // Striker faces 1 ball on a No Ball
      newState.striker.balls += 1;

      if (runType === 'bat') {
        runsAdded = 1 + additionalRuns;
        newState.striker.runs += additionalRuns;
        if (additionalRuns === 4) newState.striker.fours += 1;
        if (additionalRuns === 6) newState.striker.sixes += 1;
        
        // Bowler is penalized for no-ball penalty + runs hit
        newState.current_bowler.runs += (1 + additionalRuns);
        timelineLabel = `NB+${additionalRuns}`;
      } else {
        // Byes or leg byes on a No-Ball
        extrasAdded += additionalRuns; // additional runs go to extras
        runsAdded = 1 + additionalRuns;
        // Bowler is only penalized for the No-ball penalty (1 run), not the byes/leg-byes
        newState.current_bowler.runs += 1;
        timelineLabel = `NB+${additionalRuns}${runType === 'byes' ? 'B' : 'LB'}`;
      }

      // Rotate strike on odd additional runs
      if (additionalRuns % 2 !== 0) {
        newState = rotateStrike(newState);
      }
      break;
    }

    case 'BYES':
    case 'LEG_BYES': {
      const runs = action.value !== undefined ? action.value : (action.runsCompleted !== undefined ? action.runsCompleted : 0);
      extrasAdded = runs;
      runsAdded = runs;
      isLegal = true;
      timelineLabel = `${runs}${action.type === 'BYES' ? 'B' : 'LB'}`;

      // Batter faces a ball but gets 0 runs
      newState.striker.balls += 1;

      // Rotate strike on odd runs
      if (runs % 2 !== 0) {
        newState = rotateStrike(newState);
      }
      break;
    }

    case 'WICKET': {
      const { wicketType, dismissedBatterName, newBatterName, runsCompleted } = action;
      isLegal = wicketType !== 'run_out_wide' && wicketType !== 'run_out_noball';
      runsAdded = runsCompleted || 0;
      
      if (wicketType === 'run_out_wide') {
        // Run out on a Wide ball
        extrasAdded = 1;
        runsAdded = 1 + (runsCompleted || 0);
        newState.current_bowler.runs += 1;
        timelineLabel = `W(RO)+Wd`;
      } else if (wicketType === 'run_out_noball') {
        // Run out on a No-ball
        extrasAdded = 1;
        runsAdded = 1 + (runsCompleted || 0);
        newState.striker.balls += 1;
        newState.current_bowler.runs += 1;
        timelineLabel = `W(RO)+NB`;
      } else {
        // Standard legal ball wicket
        newState.striker.balls += 1;
        
        // Bowler gets credit for the wicket unless it's a run out
        if (wicketType !== 'run_out' && wicketType !== 'retired_hurt') {
          newState.current_bowler.wickets += 1;
        }
        
        timelineLabel = 'W';
      }

      newState.wickets += 1;

      // Handle strike rotation after wicket
      if (wicketType === 'caught' || wicketType === 'caught_behind') {
        // MCC 2022 Rule: New batter ALWAYS takes strike
        newState.striker = { name: newBatterName, runs: 0, balls: 0, fours: 0, sixes: 0 };
      } else if (wicketType === 'run_out' || wicketType === 'run_out_wide' || wicketType === 'run_out_noball') {
        // Identify if striker or non-striker was run out
        const runsCount = runsCompleted || 0;
        const runsOdd = runsCount % 2 !== 0;

        if (dismissedBatterName === newState.striker.name) {
          // Striker dismissed
          newState.striker = { name: newBatterName, runs: 0, balls: 0, fours: 0, sixes: 0 };
          // If runs completed was odd, the new striker should rotate to non-striker
          if (runsOdd) {
            newState = rotateStrike(newState);
          }
        } else {
          // Non-striker dismissed
          newState.non_striker = { name: newBatterName, runs: 0, balls: 0, fours: 0, sixes: 0 };
          // If runs completed was odd, the striker moves to non-striker
          if (runsOdd) {
            newState = rotateStrike(newState);
          }
        }
      } else {
        // Bowled, LBW, Stumped: New batter takes strike
        newState.striker = { name: newBatterName, runs: 0, balls: 0, fours: 0, sixes: 0 };
      }
      break;
    }

    case 'HELMET_PENALTY': {
      runsAdded = 5;
      extrasAdded = 5;
      isLegal = false; // Helmet penalty does not add a ball to over
      timelineLabel = '+5P';
      break;
    }
  }

  // Update total runs
  newState.total_runs += runsAdded;

  // Handle over calculations
  if (isLegal) {
    newState.balls_in_over += 1;
    if (newState.balls_in_over === 6) {
      // Over complete!
      newState.overs += 1;
      newState.balls_in_over = 0;
      
      // Update bowler's completed overs
      newState.current_bowler.overs += 1;
      newState.current_bowler.balls = 0;

      // Swap strike automatically at the end of the over
      newState = rotateStrike(newState);

      // Check for Maiden over
      // Standard definition: Bowler conceded 0 runs (off bat + wides/no-balls) in this over
      // We look at the bowler runs conceded in the over. Let's compute it.
      // For simplicity, we can inspect current over deliveries runs.
      const currentOverDeliveriesConceded = newState.current_over_timeline.reduce((acc, label) => {
        if (label === '•' || label === 'W' || label.includes('B') || label.includes('LB')) {
          // dot, wicket, byes, leg-byes don't count against bowler
          return acc;
        }
        return acc + 1; // any run or extra penalty counts against bowler
      }, 0) + (timelineLabel === '•' || timelineLabel === 'W' || timelineLabel.includes('B') || timelineLabel.includes('LB') ? 0 : runsAdded);

      if (currentOverDeliveriesConceded === 0) {
        newState.current_bowler.maidens += 1;
      }
    } else {
      newState.current_bowler.balls += 1;
    }
  }

  // Add delivery to timeline
  newState.current_over_timeline.push(timelineLabel);

  // Recalculate run rate
  newState.run_rate = calculateRunRate(newState.total_runs, newState.overs, newState.balls_in_over);

  // Update ledger for undo
  const ledgerEntry = {
    delivery_index: newState.delivery_history.length,
    over_number: newState.balls_in_over === 0 && isLegal ? newState.overs : newState.overs + 1,
    ball_number: isLegal ? (newState.balls_in_over === 0 ? 6 : newState.balls_in_over) : newState.balls_in_over + 1,
    striker_name: state.striker.name,
    non_striker_name: state.non_striker.name,
    bowler_name: state.current_bowler.name,
    runs_batter: runsAdded - extrasAdded,
    runs_extras: extrasAdded,
    extra_type: action.type === 'WIDE' ? 'wide' : (action.type === 'NO_BALL' ? 'no_ball' : (action.type === 'BYES' ? 'bye' : (action.type === 'LEG_BYES' ? 'leg_bye' : null))),
    wicket_type: action.type === 'WICKET' ? action.wicketType : null,
    dismissed_batter_name: action.type === 'WICKET' ? action.dismissedBatterName : null,
    fielder_name: action.fielderName || null,
    keeper_name: action.keeperName || null,
    is_legal: isLegal,
    innings: state.current_innings || 1,
    action: action, // Store original action for references
    prevState: state // Store previous state to support quick revert
  };

  newState.delivery_history.push(ledgerEntry);

  return newState;
}

/**
 * Performs an undo operation on the scoring state
 */
export function undoDelivery(state) {
  if (state.delivery_history.length === 0) return state;
  const history = [...state.delivery_history];
  const lastEntry = history.pop();
  
  // Restore previous state and copy the popped ledger history back
  const prevState = {
    ...lastEntry.prevState,
    delivery_history: history
  };

  return prevState;
}
