<?php
error_reporting(0); 
header('Content-Type: application/json');

session_start();

// --- CONFIG ---
$ROWS = 10;
$COLS = 10;

// --- HANDLE REQUESTS ---
if (isset($_POST['action'])) {
    if ($_POST['action'] === 'init') {
        initGame($_POST['ships']);
    } elseif ($_POST['action'] === 'fire') {
        processTurn($_POST['r'], $_POST['c']);
    }
}

// --- FUNCTIONS ---

function initGame($userShipsJson) {
    $userShips = json_decode($userShipsJson, true);
    
    // User Map
    $userBoardMap = []; 
    foreach ($userShips as $ship) {
        foreach ($ship['positions'] as $pos) {
            $userBoardMap["{$pos[0]},{$pos[1]}"] = $ship['name'];
        }
    }

    // CPU Ships
    $cpuShips = []; 
    $cpuBoardMap = [];
    $shipSizes = ['Carrier' => 5, 'Battleship' => 4, 'Cruiser' => 3, 'Submarine' => 3, 'Destroyer' => 2];

    foreach ($shipSizes as $name => $size) {
        $placed = false;
        while (!$placed) {
            $orientation = rand(0, 1);
            $r = rand(0, 9);
            $c = rand(0, 9);
            $coords = [];
            $valid = true;
            for ($i=0; $i<$size; $i++) {
                $nr = $r + ($orientation == 1 ? $i : 0);
                $nc = $c + ($orientation == 0 ? $i : 0);
                if ($nr > 9 || $nc > 9 || isset($cpuBoardMap["$nr,$nc"])) {
                    $valid = false; break;
                }
                $coords[] = [$nr, $nc];
            }
            if ($valid) {
                foreach ($coords as $pos) $cpuBoardMap["{$pos[0]},{$pos[1]}"] = $name;
                $cpuShips[$name] = $size; 
                $placed = true;
            }
        }
    }

    // --- NEW AI STATE ---
    // 'mode': 
    //    'HUNT'   = Random firing
    //    'SEEK'   = Hit once, checking 4 neighbors to find line
    //    'LOCKED' = Found line, firing along it
    $aiState = [
        'mode' => 'HUNT',
        'origin' => null,     // [r,c] of the FIRST hit on this ship
        'lastHit' => null,    // [r,c] of the MOST RECENT hit (to continue line)
        'direction' => null,  // [dr, dc] Current firing direction (e.g. [-1, 0])
        'seekStack' => []     // Neighbors to try in SEEK mode
    ];

    $_SESSION['userBoardMap'] = $userBoardMap;
    $_SESSION['cpuBoardMap'] = $cpuBoardMap;
    
    $uHealth = [];
    foreach($userShips as $s) $uHealth[$s['name']] = count($s['positions']);
    $_SESSION['userShipsHealth'] = $uHealth;

    $_SESSION['cpuShipsHealth'] = $cpuShips;
    $_SESSION['aiState'] = $aiState;
    $_SESSION['history_user'] = [];
    $_SESSION['history_cpu'] = [];

    echo json_encode([
        'status' => 'ready',
        'stats' => [
            'cpuShipsLeft' => 5,
            'userShipsLeft' => 5
        ]
    ]);
    exit; // Stop execution here to ensure no extra whitespace is sent
}

function processTurn($r, $c) {
    $userRes = "miss";
    $userSunk = null;
    $cpuRes = "miss";
    $cpuSunk = null;
    $winner = null;

    // --- 1. USER TURN ---
    $key = "$r,$c";
    if (isset($_SESSION['cpuBoardMap'][$key])) {
        $userRes = "hit";
        $shipName = $_SESSION['cpuBoardMap'][$key];
        $_SESSION['cpuShipsHealth'][$shipName]--;
        if ($_SESSION['cpuShipsHealth'][$shipName] === 0) $userSunk = $shipName;
    }

    // --- 2. CPU TURN (SMARTER AI) ---
    $ai = &$_SESSION['aiState'];
    $shot = null;
    
    // We loop until we generate a valid shot (not out of bounds, not already fired)
    // If the AI gets stuck (e.g., blocked direction), we fallback to HUNT.
    $attempts = 0; 

    while ($shot === null && $attempts < 100) {
        $attempts++;

        if ($ai['mode'] === 'HUNT') {
            // Random Fire
            $rr = rand(0, 9);
            $cc = rand(0, 9);
            if (isValidShot($rr, $cc)) $shot = [$rr, $cc];

        } elseif ($ai['mode'] === 'SEEK') {
            // We have a stack of neighbors to try
            if (empty($ai['seekStack'])) {
                $ai['mode'] = 'HUNT'; // Stack empty? Give up and hunt.
                continue;
            }
            $candidate = array_pop($ai['seekStack']);
            if (isValidShot($candidate[0], $candidate[1])) {
                $shot = $candidate;
            }

        } elseif ($ai['mode'] === 'LOCKED') {
            // Continue firing in 'direction' from 'lastHit'
            $nr = $ai['lastHit'][0] + $ai['direction'][0];
            $nc = $ai['lastHit'][1] + $ai['direction'][1];

            if (isValidShot($nr, $nc)) {
                $shot = [$nr, $nc];
            } else {
                // We hit a wall or existing miss/hit.
                // REVERSE LOGIC: Go back to origin and fire opposite way.
                reverseDirection($ai);
                // Loop will run again immediately with new direction logic
            }
        }
    }

    // Fallback if AI got confused
    if ($shot === null) {
        do { $rr = rand(0, 9); $cc = rand(0, 9); } while(!isValidShot($rr, $cc));
        $shot = [$rr, $cc];
        $ai['mode'] = 'HUNT';
    }

    // --- EXECUTE SHOT ---
    $shotKey = "{$shot[0]},{$shot[1]}";
    $_SESSION['history_cpu'][$shotKey] = true;

    if (isset($_SESSION['userBoardMap'][$shotKey])) {
        // --- HIT ---
        $cpuRes = "hit";
        $shipName = $_SESSION['userBoardMap'][$shotKey];
        $_SESSION['userShipsHealth'][$shipName]--;
        
        // CHECK SUNK
        if ($_SESSION['userShipsHealth'][$shipName] === 0) {
            $cpuSunk = $shipName;
            // RULE 1: If sunk, stop checking neighbors. Free to target others.
            $ai['mode'] = 'HUNT';
            $ai['seekStack'] = []; 
        } else {
            // NOT SUNK - UPDATE AI STATE
            if ($ai['mode'] === 'HUNT') {
                // First hit! Switch to SEEK.
                $ai['mode'] = 'SEEK';
                $ai['origin'] = $shot;
                $ai['lastHit'] = $shot; // Track for future
                
                // Push neighbors N, S, W, E
                $dirs = [[-1,0], [1,0], [0,-1], [0,1]];
                foreach($dirs as $d) {
                    $nr = $shot[0] + $d[0];
                    $nc = $shot[1] + $d[1];
                    // Note: We don't check isValidShot here strictly, we filter when popping
                    $ai['seekStack'][] = [$nr, $nc];
                }
            } elseif ($ai['mode'] === 'SEEK') {
                // We were looking for direction, and we found it!
                $ai['mode'] = 'LOCKED';
                $ai['lastHit'] = $shot;
                
                // Calculate Vector (Current - Origin)
                $dr = $shot[0] - $ai['origin'][0];
                $dc = $shot[1] - $ai['origin'][1];
                
                // Normalize vector to 1 or -1 (handles jumping over misses if we wanted, but here simpler)
                if($dr != 0) $dr = $dr / abs($dr);
                if($dc != 0) $dc = $dc / abs($dc);

                $ai['direction'] = [$dr, $dc];
                
                // RULE 2: Ships don't turn. Clear the stack of other directions.
                $ai['seekStack'] = []; 
            } elseif ($ai['mode'] === 'LOCKED') {
                // Keep going!
                $ai['lastHit'] = $shot;
            }
        }

    } else {
        // --- MISS ---
        $cpuRes = "miss";
        
        if ($ai['mode'] === 'LOCKED') {
            // We missed while locked on a line.
            // RULE: "Continue firing in opposite direction starting from first spot"
            reverseDirection($ai);
        }
    }

    // --- STATS & WIN CHECK ---
    $cpuLeft = 0; foreach($_SESSION['cpuShipsHealth'] as $h) if($h > 0) $cpuLeft++;
    $userLeft = 0; foreach($_SESSION['userShipsHealth'] as $h) if($h > 0) $userLeft++;

    if ($cpuLeft == 0) $winner = "USER";
    if ($userLeft == 0) $winner = "CPU";

    echo json_encode([
        'userResult' => $userRes,
        'userSunkShip' => $userSunk,
        'cpuShot' => ['r' => $shot[0], 'c' => $shot[1]],
        'cpuResult' => $cpuRes,
        'cpuSunkShip' => $cpuSunk,
        'winner' => $winner,
        'stats' => ['cpuShipsLeft' => $cpuLeft, 'userShipsLeft' => $userLeft]
    ]);
}

// Helper to flip AI to the other side of the origin
function reverseDirection(&$ai) {
    // 1. Flip vector
    $ai['direction'][0] *= -1;
    $ai['direction'][1] *= -1;
    
    // 2. Reset starting point to the ORIGINAL hit (so we fire backwards from start)
    $ai['lastHit'] = $ai['origin'];
}

function isValidShot($r, $c) {
    if ($r < 0 || $r > 9 || $c < 0 || $c > 9) return false;
    if (isset($_SESSION['history_cpu']["$r,$c"])) return false;
    return true;
}
?>