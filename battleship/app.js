const ROWS = 10;
const COLS = 10;
const LETTERS = ['A','B','C','D','E','F','G','H','I','J'];

let userShips = []; 
let placementOrientation = 'H';
let currentShipSize = 0;
let currentShipName = "";
let shipsToPlace = {
    'Destroyer': 1, 'Submarine': 1, 'Cruiser': 1, 'Battleship': 1, 'Carrier': 1
};
let gameActive = false;

// GLOBAL TRACKERS (This fixes the highlighting issue)
let hoverR = -1;
let hoverC = -1;

window.onload = function() {
    createGrid('user-grid', true);
    createGrid('cpu-grid', false);
    drawLabels();
};

function createGrid(elementId, isUser) {
    const grid = document.getElementById(elementId);
    grid.innerHTML = '';
    
    // --- NEW: Calculate Grid Coordinates from Mouse Position ---
    if (isUser) {
        // 1. Calculate R and C based on mouse pixels (Robust Method)
        grid.addEventListener('mousemove', (e) => {
            const rect = grid.getBoundingClientRect();
            // Account for border/padding if necessary, but roughly:
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // 30px is the cell size defined in CSS
            const c = Math.floor(x / 30);
            const r = Math.floor(y / 30);

            // Only update if we moved to a new cell
            if (r !== hoverR || c !== hoverC) {
                hoverR = r;
                hoverC = c;
                showPreview();
            }
        });

        // 2. Clear when leaving the big grid box
        grid.addEventListener('mouseleave', () => {
            hoverR = -1;
            hoverC = -1;
            removePreview();
        });

        // 3. Right Click Rotation
        grid.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            toggleOrientation();
        });
        
        // 4. Click to Place (using the calculated coordinates)
        grid.addEventListener('click', (e) => {
            if(hoverR !== -1 && hoverC !== -1) {
                placeShipClick(hoverR, hoverC);
            }
        });
    }

    // Create visual cells (We don't need individual listeners on them anymore for User)
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.r = r;
            cell.dataset.c = c;
            
            // CPU Grid still needs click logic for firing
            if (!isUser) {
                cell.onclick = () => fireShot(r, c, cell);
            }
            grid.appendChild(cell);
        }
    }
}

function drawLabels() {
    const tops = document.querySelectorAll('.grid-labels-top');
    const sides = document.querySelectorAll('.grid-labels-side');
    tops.forEach(div => { for(let i=1; i<=10; i++) div.innerHTML += `<div>${i}</div>`; });
    sides.forEach(div => { for(let i=0; i<10; i++) div.innerHTML += `<div>${LETTERS[i]}</div>`; });
}

// --- PLACEMENT LOGIC ---

function manualRotate() {
    toggleOrientation();
}

function toggleOrientation() {
    placementOrientation = placementOrientation === 'H' ? 'V' : 'H';
    let btn = document.getElementById('rotate-btn');
    if(btn) btn.innerText = placementOrientation === 'H' ? "Horizontal" : "Vertical";
    
    // Immediate update because we know where the mouse is (hoverR/C)
    showPreview();
}

// Pass 'this' from HTML to handle active button state correctly
function selectShip(size, name, btnEl) {
    if (shipsToPlace[name] <= 0) return;
    currentShipSize = size;
    currentShipName = name;
    
    // Update UI
    document.querySelectorAll('.ship-btn').forEach(b => b.classList.remove('active'));
    // If the button element was passed, use it. Otherwise find it.
    if(btnEl) {
        btnEl.classList.add('active');
    } else {
        // Fallback if 'this' wasn't passed in HTML
        let buttons = document.querySelectorAll('.ship-btn');
        for(let b of buttons) {
            if(b.innerText.includes(name)) b.classList.add('active');
        }
    }
}

function getShipCoords(r, c, size, orientation) {
    let coords = [];
    for (let i = 0; i < size; i++) {
        let nr = r + (orientation === 'V' ? i : 0);
        let nc = c + (orientation === 'H' ? i : 0);
        coords.push([nr, nc]);
    }
    return coords;
}

// --- PREVIEW LOGIC (Coordinate Based) ---

function showPreview() {
    // If mouse is outside (coords -1) or no ship selected
    if (hoverR < 0 || hoverR >= ROWS || hoverC < 0 || hoverC >= COLS || currentShipSize === 0) {
        removePreview();
        return;
    }

    removePreview();

    let coords = getShipCoords(hoverR, hoverC, currentShipSize, placementOrientation);
    let isValid = true;

    // Check bounds and overlap
    for (let [nr, nc] of coords) {
        if (nr >= 10 || nc >= 10) { isValid = false; break; }
        if (userShips.some(s => s.positions.some(p => p[0] === nr && p[1] === nc))) { isValid = false; break; }
    }

    coords.forEach(([nr, nc]) => {
        if (nr < 10 && nc < 10) {
            let cell = document.querySelector(`#user-grid .cell[data-r='${nr}'][data-c='${nc}']`);
            if (cell) cell.classList.add(isValid ? 'preview' : 'preview-invalid');
        }
    });
}

function removePreview() {
    document.querySelectorAll('.preview, .preview-invalid').forEach(el => {
        el.classList.remove('preview');
        el.classList.remove('preview-invalid');
    });
}

function placeShipClick(r, c) {
    if (currentShipSize === 0) return;
    
    let coords = getShipCoords(r, c, currentShipSize, placementOrientation);
    
    // Validation
    for (let [nr, nc] of coords) {
        if (nr >= 10 || nc >= 10) return;
        if (userShips.some(s => s.positions.some(p => p[0] === nr && p[1] === nc))) return;
    }

    // Place
    coords.forEach(([xr, xc]) => {
        let cell = document.querySelector(`#user-grid .cell[data-r='${xr}'][data-c='${xc}']`);
        cell.classList.add('placed');
    });

    userShips.push({ name: currentShipName, positions: coords });
    shipsToPlace[currentShipName]--;
    
    // Disable button and reset selection
    if (shipsToPlace[currentShipName] === 0) {
        let btn = Array.from(document.querySelectorAll('.ship-btn')).find(b => b.innerText.includes(currentShipName));
        if(btn) {
            btn.disabled = true;
            btn.classList.remove('active');
        }
        currentShipSize = 0;
        removePreview();
    }

    if (Object.values(shipsToPlace).every(v => v === 0)) {
        document.getElementById('start-btn').disabled = false;
        document.getElementById('status-message').innerText = "Fleet ready! Press Start.";
    }
}

// --- GAME LOGIC ---

function startGame() {
    const scoreboard = document.getElementById('scoreboard');
    const setupPanel = document.getElementById('setup-panel');
    const gamePanel = document.getElementById('game-panel');
    const cpuGrid = document.getElementById('cpu-grid');

    // DEFENSIVE CHECK: If any element is missing, log it instead of crashing
    if (!scoreboard || !setupPanel || !gamePanel || !cpuGrid) {
        console.error("Missing UI elements! Check index.html for IDs: scoreboard, setup-panel, game-panel, cpu-grid.");
        return; 
    }

    fetch('backend.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'action=init&ships=' + JSON.stringify(userShips)
    })
    .then(res => {
        if (!res.ok) throw new Error("Server response was not ok");
        return res.json();
    })
    .then(data => {
        // Now it's safe to change styles
        setupPanel.style.display = 'none';
        scoreboard.style.display = 'flex';
        gamePanel.style.display = 'block';
        cpuGrid.classList.remove('locked');
        
        document.getElementById('status-message').innerText = "Target Locked. Commencing Fire!";
        
        if (data.stats) {
            document.getElementById('cpu-score').innerText = data.stats.cpuShipsLeft;
            document.getElementById('user-score').innerText = data.stats.userShipsLeft;
        }
        
        gameActive = true;
    })
    .catch(err => {
        console.error("Fetch error:", err);
        alert("Could not start game. Is backend.php running on XAMPP?");
    });
}

function fireShot(r, c, cellElement) {
    if (!gameActive || cellElement.classList.contains('hit') || cellElement.classList.contains('miss')) return;

    fetch('backend.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: `action=fire&r=${r}&c=${c}`
    })
    .then(res => res.json())
    .then(data => {
        // Update Boards
        updateCell('cpu-grid', r, c, data.userResult);
        if (data.cpuShot) {
            updateCell('user-grid', data.cpuShot.r, data.cpuShot.c, data.cpuResult);
        }

        // Update Score
        document.getElementById('cpu-score').innerText = data.stats.cpuShipsLeft;
        document.getElementById('user-score').innerText = data.stats.userShipsLeft;

        // Sounds
        let playHit = false;
        let playSunk = false;

        if (data.userSunkShip) {
            log(`You sunk the enemy ${data.userSunkShip}!`);
            playSunk = true;
        } else if (data.userResult === 'hit') playHit = true;

        if (data.cpuSunkShip) {
            log(`Enemy sunk your ${data.cpuSunkShip}!`);
            playSunk = true;
        }

        if (data.winner) {
            gameActive = false;
            let msgBox = document.getElementById('game-over-message');
            if (data.winner === 'USER') {
                document.getElementById('status-message').innerText = "VICTORY!";
                msgBox.innerText = "YOU WIN!";
                msgBox.style.color = "#64ffda";
                playSound('win');
            } else {
                document.getElementById('status-message').innerText = "DEFEAT!";
                msgBox.innerText = "YOU LOSE!";
                msgBox.style.color = "#ff4d4d";
                playSound('lose');
            }
        } else {
            if (playSunk) playSound('sunk');
            else if (playHit) playSound('hit');
        }
    });
}

function updateCell(gridId, r, c, status) {
    let cell = document.querySelector(`#${gridId} .cell[data-r='${r}'][data-c='${c}']`);
    if (status === 'hit') cell.classList.add('hit');
    if (status === 'miss') cell.classList.add('miss');
}

function log(msg) {
    let div = document.createElement('div');
    div.innerText = "> " + msg;
    document.getElementById('battle-log').prepend(div);
}

function playSound(type) {
    let id = 'snd-' + type;
    let audio = document.getElementById(id);
    if(audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio blocked"));
    }
}