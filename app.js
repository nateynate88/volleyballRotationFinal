const formations = [
  { id: "home", label: "Home" },
  { id: "serve", label: "Serve" },
  { id: "receive", label: "Receive" },
  { id: "defense", label: "Base" },
];

const positionOptions = ["", "S", "OH", "MB", "OPP", "L", "DS"];

const defaultZones = [
  { x: 79, y: 78 },
  { x: 79, y: 22 },
  { x: 50, y: 22 },
  { x: 21, y: 22 },
  { x: 21, y: 78 },
  { x: 50, y: 78 },
];

const placementBounds = {
  minX: 3,
  maxX: 97,
  minY: 3,
  maxY: 97,
};

const formationAdjustments = {
  home: [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ],
  serve: [
    { x: 6, y: 9 },
    { x: 5, y: -5 },
    { x: 0, y: -4 },
    { x: -5, y: -5 },
    { x: -5, y: 8 },
    { x: 0, y: 7 },
  ],
  receive: [
    { x: 0, y: -10 },
    { x: 6, y: 8 },
    { x: 0, y: 7 },
    { x: -6, y: 8 },
    { x: -8, y: -8 },
    { x: 8, y: -8 },
  ],
  defense: [
    { x: 6, y: -6 },
    { x: 4, y: -2 },
    { x: 0, y: -2 },
    { x: -4, y: -2 },
    { x: -4, y: -7 },
    { x: 4, y: -7 },
  ],
};

const storageKey = "volley-lineup-state";
const libraryStorageKey = "volley-lineup-library";

const state = {
  rotation: 1,
  formation: "home",
  highlightedPlayerId: null,
  homeOverrides: {},
  phaseOverrides: {},
  players: createInitialPlayers(),
  placements: {},
};

let drag = null;
let pendingHomeSlot = null;
const chipCache = new Map();
const undoStack = [];
let lineupLibrary = {
  activeId: null,
  lineups: [],
};
let pendingDeleteLineupId = null;
let pendingDeletePlayerId = null;
let editingPlayerId = null;
let coachCheckExpanded = false;

const rotationStrip = document.querySelector("#rotationStrip");
const formationStrip = document.querySelector("#formationStrip");
const court = document.querySelector("#court");
const courtPlayers = document.querySelector("#courtPlayers");
const benchZone = document.querySelector("#benchZone");
const benchList = document.querySelector("#benchList");
const chipTemplate = document.querySelector("#playerChipTemplate");
const addPlayerForm = document.querySelector("#addPlayerForm");
const addPlayerDialog = document.querySelector("#addPlayerDialog");
const playerFirstNameInput = document.querySelector("#playerFirstNameInput");
const playerLastNameInput = document.querySelector("#playerLastNameInput");
const playerNumberInput = document.querySelector("#playerNumberInput");
const playerPositionInput = document.querySelector("#playerPositionInput");
const cancelAddPlayerButton = document.querySelector("#cancelAddPlayerButton");
const deletePlayerDialogButton = document.querySelector("#deletePlayerDialogButton");
const undoButton = document.querySelector("#undoButton");
const lineupSelect = document.querySelector("#lineupSelect");
const lineupMenuButton = document.querySelector("#lineupMenuButton");
const lineupMenu = document.querySelector("#lineupMenu");
const newLineupButton = document.querySelector("#newLineupButton");
const renameLineupButton = document.querySelector("#renameLineupButton");
const shareLineupButton = document.querySelector("#shareLineupButton");
const deleteLineupButton = document.querySelector("#deleteLineupButton");
const lineupStatus = document.querySelector("#lineupStatus");
const newLineupDialog = document.querySelector("#newLineupDialog");
const newLineupForm = document.querySelector("#newLineupForm");
const newLineupNameInput = document.querySelector("#newLineupNameInput");
const newLineupImportSource = document.querySelector("#newLineupImportSource");
const newLineupImportPlayers = document.querySelector("#newLineupImportPlayers");
const newLineupImportPositions = document.querySelector("#newLineupImportPositions");
const cancelNewLineupButton = document.querySelector("#cancelNewLineupButton");
const renameLineupDialog = document.querySelector("#renameLineupDialog");
const renameLineupForm = document.querySelector("#renameLineupForm");
const renameLineupNameInput = document.querySelector("#renameLineupNameInput");
const cancelRenameLineupButton = document.querySelector("#cancelRenameLineupButton");
const shareLineupDialog = document.querySelector("#shareLineupDialog");
const shareLineupText = document.querySelector("#shareLineupText");
const copyShareLineupButton = document.querySelector("#copyShareLineupButton");
const closeShareLineupButton = document.querySelector("#closeShareLineupButton");
const playerDialogTitle = document.querySelector("#playerDialogTitle");
const savePlayerDialogButton = document.querySelector("#savePlayerDialogButton");
const liberoWarning = document.querySelector("#liberoWarning");
const coachCheck = document.querySelector(".coach-check");
const coachCheckToggle = document.querySelector("#coachCheckToggle");
const coachCheckCount = document.querySelector("#coachCheckCount");
const coachCheckList = document.querySelector("#coachCheckList");

const subPicker = document.createElement("div");
subPicker.className = "sub-picker";
subPicker.hidden = true;
court.append(subPicker);

function makeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createInitialPlayers() {
  return [];
}

function renderPositionOptions(select, placeholder = "No position") {
  select.innerHTML = "";
  positionOptions.forEach((position) => {
    const option = document.createElement("option");
    option.value = position;
    option.textContent = position || placeholder;
    select.append(option);
  });
}

function defaultLineupData() {
  return {
    rotation: 1,
    formation: "home",
    highlightedPlayerId: null,
    homeOverrides: {},
    phaseOverrides: {},
    players: createInitialPlayers(),
    placements: {},
  };
}

function cloneLineupData(data) {
  return JSON.parse(JSON.stringify(data));
}

function currentLineupData() {
  return cloneLineupData({
    rotation: state.rotation,
    formation: state.formation,
    highlightedPlayerId: state.highlightedPlayerId,
    homeOverrides: state.homeOverrides,
    phaseOverrides: state.phaseOverrides,
    players: state.players,
    placements: state.placements,
  });
}

function applyLineupData(data) {
  const source = cloneLineupData(data);
  state.rotation = Number.isInteger(source.rotation) && source.rotation >= 1 && source.rotation <= 6 ? source.rotation : 1;
  state.formation = formations.some((formation) => formation.id === source.formation) ? source.formation : "home";
  state.highlightedPlayerId = typeof source.highlightedPlayerId === "string" ? source.highlightedPlayerId : null;
  state.homeOverrides = source.homeOverrides && typeof source.homeOverrides === "object" ? source.homeOverrides : {};
  state.phaseOverrides = source.phaseOverrides && typeof source.phaseOverrides === "object" ? source.phaseOverrides : {};
  state.players = Array.isArray(source.players)
    ? source.players.map((player, index) => ({
      id: player.id ?? makeId(),
      firstName: player.firstName ?? splitLegacyName(player.name ?? `Player ${index + 1}`).firstName,
      lastName: player.lastName ?? splitLegacyName(player.name ?? "").lastName,
      number: player.number ?? index + 1,
      position: player.position ?? "",
    }))
    : createInitialPlayers();
  state.placements = source.placements && typeof source.placements === "object" ? source.placements : {};
  chipCache.forEach((chip) => chip.remove());
  chipCache.clear();
}

function normalizeLineupData(data) {
  const previous = currentLineupData();
  applyLineupData(data);
  const normalized = currentLineupData();
  applyLineupData(previous);
  return normalized;
}

function loadLegacyState() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    return normalizeLineupData(parsed);
  } catch {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Storage may be disabled in private or restricted browser modes.
    }
  }
  return null;
}

function loadLineupLibrary() {
  try {
    const saved = localStorage.getItem(libraryStorageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.lineups) && parsed.lineups.length) {
        lineupLibrary = {
          activeId: parsed.activeId,
          lineups: parsed.lineups.map((lineup, index) => ({
            id: lineup.id ?? makeId(),
            name: lineup.name || `Lineup ${index + 1}`,
            data: normalizeLineupData(lineup.data ?? defaultLineupData()),
          })),
        };
      }
    }
  } catch {
    lineupLibrary = { activeId: null, lineups: [] };
  }

  if (!lineupLibrary.lineups.length) {
    lineupLibrary.lineups = [{
      id: makeId(),
      name: "Lineup 1",
      data: loadLegacyState() ?? defaultLineupData(),
    }];
  }
  if (!lineupLibrary.lineups.some((lineup) => lineup.id === lineupLibrary.activeId)) {
    lineupLibrary.activeId = lineupLibrary.lineups[0].id;
  }
  applyLineupData(activeLineup().data);
}

function activeLineup() {
  return lineupLibrary.lineups.find((lineup) => lineup.id === lineupLibrary.activeId) ?? lineupLibrary.lineups[0];
}

function saveLineupLibrary() {
  try {
    localStorage.setItem(libraryStorageKey, JSON.stringify(lineupLibrary));
  } catch {
    // The current session still works if persistent storage is unavailable.
  }
}

function splitLegacyName(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Player",
    lastName: parts.slice(1).join(" "),
  };
}

function fullName(player) {
  return [player.firstName, player.lastName].filter(Boolean).join(" ") || "Unnamed";
}

function initials(player) {
  const first = player.firstName?.trim().charAt(0) ?? "";
  const last = player.lastName?.trim().charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

function normalizePlayerNumber(value, fallback = "") {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 2);
  if (!digits) return fallback;
  return String(Math.min(99, Math.max(0, Number(digits))));
}

function rosterDisplayName(player) {
  const firstName = player.firstName?.trim();
  const lastInitial = player.lastName?.trim().charAt(0);
  if (firstName && lastInitial) return `${firstName} ${lastInitial}.`;
  if (firstName) return firstName;
  return initials(player);
}

function saveState() {
  const lineup = activeLineup();
  if (lineup) {
    lineup.data = currentLineupData();
  }
  saveLineupLibrary();
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(currentLineupData()),
    );
  } catch {
    // The editor still works for the current session if saving is unavailable.
  }
}

function snapshotState() {
  return JSON.stringify({
    rotation: state.rotation,
    formation: state.formation,
    highlightedPlayerId: state.highlightedPlayerId,
    homeOverrides: state.homeOverrides,
    phaseOverrides: state.phaseOverrides,
    players: state.players,
    placements: state.placements,
  });
}

function restoreSnapshot(snapshot) {
  const parsed = JSON.parse(snapshot);
  state.rotation = parsed.rotation;
  state.formation = parsed.formation;
  state.highlightedPlayerId = parsed.highlightedPlayerId;
  state.homeOverrides = parsed.homeOverrides ?? {};
  state.phaseOverrides = parsed.phaseOverrides ?? {};
  state.players = parsed.players ?? [];
  state.placements = parsed.placements ?? {};
}

function pushUndo() {
  undoStack.push(snapshotState());
  if (undoStack.length > 50) {
    undoStack.shift();
  }
  updateUndoButton();
}

function undoLastAction() {
  const previous = undoStack.pop();
  if (!previous) return;
  restoreSnapshot(previous);
  closeSubPicker();
  saveState();
  render();
  updateUndoButton();
}

function updateUndoButton() {
  undoButton.disabled = undoStack.length === 0;
}

function commitAction(action) {
  pushUndo();
  action();
  saveState();
}

function keyFor(rotation = state.rotation, formation = state.formation) {
  return `r${rotation}:${formation}`;
}

function currentPlacements() {
  const key = keyFor();
  if (!state.placements[key]) {
    state.placements[key] = {};
  }
  return state.placements[key];
}

function playerById(playerId) {
  return state.players.find((player) => player.id === playerId);
}

function homePlacementFor(playerId, rotation = state.rotation) {
  return state.placements[keyFor(rotation, "home")]?.[playerId];
}

function homeRowFor(playerId, rotation = state.rotation) {
  const placement = homePlacementFor(playerId, rotation);
  if (!placement) return null;
  return placement.y < 50 ? "front" : "back";
}

function homeZoneFor(playerId, rotation = state.rotation) {
  const placement = homePlacementFor(playerId, rotation);
  return placement ? nearestZoneIndex(placement) + 1 : null;
}

function isHomePhase() {
  return state.formation === "home";
}

function markPhaseEdited(rotation = state.rotation, formation = state.formation) {
  if (formation === "home") return;
  state.phaseOverrides[keyFor(rotation, formation)] = true;
}

function frontRowLiberos() {
  return state.players.filter((player) => player.position === "L" && homeRowFor(player.id) === "front");
}

const overlapChecks = [
  { frontZone: 2, backZone: 1 },
  { frontZone: 3, backZone: 6 },
  { frontZone: 4, backZone: 5 },
  { leftZone: 4, rightZone: 3, row: "front" },
  { leftZone: 3, rightZone: 2, row: "front" },
  { leftZone: 5, rightZone: 6, row: "back" },
  { leftZone: 6, rightZone: 1, row: "back" },
];

function placedPlayers(rotation = state.rotation, formation = state.formation) {
  const placements = state.placements[keyFor(rotation, formation)] ?? {};
  return Object.entries(placements)
    .map(([playerId, placement]) => ({ player: playerById(playerId), placement }))
    .filter(({ player }) => player);
}

function formationLabel(formationId) {
  return formations.find((formation) => formation.id === formationId)?.label ?? formationId;
}

function legalityWarnings(rotation = state.rotation, formation = state.formation) {
  const warnings = [];
  const onCourtCount = placedPlayers(rotation, formation).length;

  if (onCourtCount > 6) {
    warnings.push(`${formationLabel(formation)} R${rotation}: ${onCourtCount} players are on the court. Limit is 6.`);
  }

  const liberoNames = state.players
    .filter((player) => player.position === "L" && homeRowFor(player.id, rotation) === "front")
    .map((player) => initials(player));
  if (liberoNames.length) {
    warnings.push(`Libero front row in R${rotation}: sub ${liberoNames.join(", ")}.`);
  }

  if (formation === "serve" || formation === "receive") {
    warnings.push(...overlapWarnings(rotation, formation));
  }

  return warnings;
}

function advisoryNotes(rotation = state.rotation, formation = state.formation) {
  if (formation !== "serve" && formation !== "receive") return [];

  return placedPlayers(rotation, formation)
    .filter(({ player }) => (
      player.position === "MB" &&
      homeRowFor(player.id, rotation) === "back" &&
      !(formation === "serve" && homeZoneFor(player.id, rotation) === 1)
    ))
    .map(({ player }) => `${formationLabel(formation)} note R${rotation}: ${initials(player)} is a back-row middle. You may want a libero/DS replacement.`);
}

function playersByHomeZone(rotation) {
  const homePlacements = state.placements[keyFor(rotation, "home")] ?? {};
  const zones = new Map();
  Object.entries(homePlacements).forEach(([playerId, placement]) => {
    const player = playerById(playerId);
    if (!player) return;
    zones.set(nearestZoneIndex(placement) + 1, player);
  });
  return zones;
}

function phasePlacementFor(player, rotation, formation) {
  return state.placements[keyFor(rotation, formation)]?.[player.id];
}

function overlapWarnings(rotation, formation) {
  const zones = playersByHomeZone(rotation);
  const warnings = [];
  const serverZoneIsExempt = formation === "serve";

  overlapChecks.forEach((check) => {
    if ("frontZone" in check) {
      if (serverZoneIsExempt && (check.frontZone === 1 || check.backZone === 1)) return;
      const frontPlayer = zones.get(check.frontZone);
      const backPlayer = zones.get(check.backZone);
      const frontPlacement = frontPlayer && phasePlacementFor(frontPlayer, rotation, formation);
      const backPlacement = backPlayer && phasePlacementFor(backPlayer, rotation, formation);
      if (!frontPlayer || !backPlayer || !frontPlacement || !backPlacement) return;

      if (frontPlacement.y >= backPlacement.y) {
        warnings.push(
          `${formationLabel(formation)} overlap R${rotation}: ${initials(frontPlayer)} must stay in front of ${initials(backPlayer)}.`,
        );
      }
      return;
    }

    if (serverZoneIsExempt && (check.leftZone === 1 || check.rightZone === 1)) return;
    const leftPlayer = zones.get(check.leftZone);
    const rightPlayer = zones.get(check.rightZone);
    const leftPlacement = leftPlayer && phasePlacementFor(leftPlayer, rotation, formation);
    const rightPlacement = rightPlayer && phasePlacementFor(rightPlayer, rotation, formation);
    if (!leftPlayer || !rightPlayer || !leftPlacement || !rightPlacement) return;

    if (leftPlacement.x >= rightPlacement.x) {
      warnings.push(
        `${formationLabel(formation)} overlap R${rotation}: ${initials(leftPlayer)} must stay left of ${initials(rightPlayer)}.`,
      );
    }
  });

  return warnings;
}

function isBenchPlayer(playerId) {
  return !currentPlacements()[playerId];
}

function openHomeSlotPlayers() {
  const placements = currentPlacements();
  return state.players.filter((player) => !placements[player.id]);
}

function occupiedHomeZoneIndexes() {
  return new Set(
    Object.values(currentPlacements()).map((placement) => nearestZoneIndex(placement)),
  );
}

function playerInHomeZone(zoneIndex, ignoredPlayerId = null) {
  return Object.entries(currentPlacements()).find(([playerId, placement]) => (
    playerId !== ignoredPlayerId && nearestZoneIndex(placement) === zoneIndex
  ))?.[0] ?? null;
}

function syncAfterHomeChange() {
  if (!state.homeOverrides[state.rotation]) {
    syncHomeRotations();
  }
  syncPhaseRostersFromHome(state.rotation);
}

function markHomeOverrideForSlot(zoneIndex) {
  if (!isHomePhase() || state.rotation === 1) return;
  if (defaultZones[zoneIndex]?.y < 50) {
    state.homeOverrides[state.rotation] = true;
  }
}

function nearestZoneIndex(placement) {
  return defaultZones.reduce(
    (nearest, zone, index) => {
      const distance = Math.hypot(placement.x - zone.x, placement.y - zone.y);
      return distance < nearest.distance ? { distance, index } : nearest;
    },
    { distance: Infinity, index: 0 },
  ).index;
}

function rotatePlacementClockwise(placement) {
  const zoneIndex = nearestZoneIndex(placement);
  const nextZone = defaultZones[(zoneIndex + defaultZones.length - 1) % defaultZones.length];
  const currentZone = defaultZones[zoneIndex];
  return {
    x: clamp(nextZone.x + (placement.x - currentZone.x), placementBounds.minX, placementBounds.maxX),
    y: clamp(nextZone.y + (placement.y - currentZone.y), placementBounds.minY, placementBounds.maxY),
  };
}

function syncHomeRotations() {
  seedRotation(1);
  for (let rotation = 2; rotation <= 6; rotation += 1) {
    if (state.homeOverrides[rotation]) continue;

    const previousHome = state.placements[keyFor(rotation - 1, "home")] ?? {};
    const currentHome = {};
    state.players.forEach((player) => {
      if (previousHome[player.id]) {
        currentHome[player.id] = rotatePlacementClockwise(previousHome[player.id]);
      }
    });
    state.placements[keyFor(rotation, "home")] = currentHome;
  }
  syncPhaseRostersFromHome();
}

function adjustedPlacementForPhase(placement, formationId) {
  const zoneIndex = nearestZoneIndex(placement);
  const zone = defaultZones[zoneIndex];
  const adjustment = formationAdjustments[formationId]?.[zoneIndex] ?? { x: 0, y: 0 };
  return {
    x: clamp(placement.x + adjustment.x, placementBounds.minX, placementBounds.maxX),
    y: clamp(placement.y + adjustment.y, placementBounds.minY, placementBounds.maxY),
  };
}

function syncedPhasePlacementsFromHome(rotation, formationId) {
  const homePlacements = state.placements[keyFor(rotation, "home")] ?? {};
  return Object.fromEntries(
    Object.entries(homePlacements)
      .filter(([playerId]) => playerById(playerId))
      .map(([playerId, placement]) => [playerId, adjustedPlacementForPhase(placement, formationId)]),
  );
}

function syncPhaseRostersFromHome(rotation = null) {
  const rotations = rotation ? [rotation] : [1, 2, 3, 4, 5, 6];
  rotations.forEach((rotationNumber) => {
    const homePlacements = state.placements[keyFor(rotationNumber, "home")] ?? {};
    formations.forEach(({ id }) => {
      if (id === "home") return;

      const existing = state.placements[keyFor(rotationNumber, id)] ?? {};
      state.placements[keyFor(rotationNumber, id)] = Object.fromEntries(
        Object.entries(homePlacements)
          .filter(([playerId]) => playerById(playerId))
          .map(([playerId, placement]) => [
            playerId,
            existing[playerId] ?? adjustedPlacementForPhase(placement, id),
          ]),
      );
    });
  });
}

function defaultPlacementFor(rotation, formationId, playerIndex) {
  const base = defaultZones[(playerIndex + rotation - 1) % 6];
  const adjustment = formationAdjustments[formationId]?.[playerIndex] ?? { x: 0, y: 0 };
  return {
    x: clamp(base.x + adjustment.x, placementBounds.minX, placementBounds.maxX),
    y: clamp(base.y + adjustment.y, placementBounds.minY, placementBounds.maxY),
  };
}

function seedRotation(rotation) {
  const homeKey = keyFor(rotation, "home");
  if (!state.placements[homeKey]) {
    state.placements[homeKey] = {};
    state.players.slice(0, 6).forEach((player, index) => {
      state.placements[homeKey][player.id] = defaultPlacementFor(rotation, "home", index);
    });
  }

  formations.forEach(({ id }) => {
    if (id === "home") return;
    const key = keyFor(rotation, id);
    if (state.placements[key]) return;
    state.placements[key] = syncedPhasePlacementsFromHome(rotation, id);
  });
}

function upgradeLegacyPhaseDefaults() {
  for (let rotation = 1; rotation <= 6; rotation += 1) {
    formations.forEach(({ id }) => {
      if (id === "home") return;
      const placements = state.placements[keyFor(rotation, id)];
      if (!placements || !isLegacyDefaultFormation(rotation, placements)) return;

      state.players.slice(0, 6).forEach((player, index) => {
        placements[player.id] = defaultPlacementFor(rotation, id, index);
      });
    });
  }
}

function isLegacyDefaultFormation(rotation, placements) {
  return state.players.slice(0, 6).every((player, index) => {
    const placement = placements[player.id];
    const legacy = defaultZones[(index + rotation - 1) % 6];
    return placement && Math.abs(placement.x - legacy.x) < 0.01 && Math.abs(placement.y - legacy.y) < 0.01;
  });
}

function renderTabs() {
  rotationStrip.innerHTML = "";
  for (let rotation = 1; rotation <= 6; rotation += 1) {
    const button = document.createElement("button");
    button.className = `tab-button${state.rotation === rotation ? " active" : ""}`;
    button.type = "button";
    button.textContent = `R${rotation}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(state.rotation === rotation));
    button.addEventListener("click", () => {
      if (state.rotation === rotation) return;
      renderWithMovement(() => {
        state.rotation = rotation;
        seedRotation(rotation);
        saveState();
      });
      playRotationCue();
    });
    rotationStrip.append(button);
  }

  formationStrip.innerHTML = "";
  formations.forEach((formation) => {
    const button = document.createElement("button");
    button.className = `tab-button${state.formation === formation.id ? " active" : ""}`;
    button.type = "button";
    button.textContent = formation.label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(state.formation === formation.id));
    button.addEventListener("click", () => {
      if (state.formation === formation.id) return;
      renderWithMovement(() => {
        state.formation = formation.id;
        saveState();
      });
    });
    formationStrip.append(button);
  });
}

function createChip(player, placement) {
  const chip = chipCache.get(player.id) ?? chipTemplate.content.firstElementChild.cloneNode(true);
  if (!chipCache.has(player.id)) {
    chip.addEventListener("pointerdown", startDrag);
    chipCache.set(player.id, chip);
  }

  chip.dataset.playerId = player.id;
  chip.querySelector(".player-number").textContent = player.number;
  chip.querySelector(".player-name").textContent = initials(player);
  chip.querySelector(".player-position").textContent = player.position;
  chip.querySelector(".home-remove")?.remove();
  chip.querySelector(".bench-edit")?.remove();
  const homeRow = homeRowFor(player.id);
  chip.classList.toggle("libero", player.position === "L");
  chip.classList.toggle("home-fixed", isHomePhase());
  chip.classList.toggle("front-row-player", Boolean(placement) && homeRow === "front");
  chip.classList.toggle("back-row-player", Boolean(placement) && homeRow === "back");
  chip.classList.toggle("libero-front-warning", player.position === "L" && homeRow === "front");
  chip.classList.toggle("highlighted", state.highlightedPlayerId === player.id);
  chip.classList.toggle("dimmed", Boolean(state.highlightedPlayerId) && state.highlightedPlayerId !== player.id);
  chip.setAttribute(
    "aria-label",
    `${fullName(player)}, number ${player.number}${player.position ? `, ${player.position}` : ""}`,
  );

  if (placement) {
    chip.classList.add("on-court");
    chip.style.left = `${placement.x}%`;
    chip.style.top = `${placement.y}%`;
    if (isHomePhase()) {
      chip.append(createHomeRemoveControl(player.id));
    }
  } else {
    chip.classList.remove("on-court");
    chip.style.left = "";
    chip.style.top = "";
    chip.append(createBenchEditControl(player.id));
  }

  return chip;
}

function renderPlayers() {
  const placements = currentPlacements();
  if (state.highlightedPlayerId && !placements[state.highlightedPlayerId]) {
    state.highlightedPlayerId = null;
    saveState();
  }

  const activePlayerIds = new Set(state.players.map((player) => player.id));
  chipCache.forEach((chip, playerId) => {
    if (!activePlayerIds.has(playerId)) {
      chip.remove();
      chipCache.delete(playerId);
    }
  });

  benchList.querySelector(".empty-note")?.remove();
  benchList.querySelector(".bench-add-player")?.remove();

  state.players.forEach((player) => {
    const placement = placements[player.id];
    const chip = createChip(player, placement);
    if (placement) {
      courtPlayers.append(chip);
    } else {
      benchList.append(chip);
    }
  });

  benchList.append(createBenchAddButton());

  renderHomeOpenSlots();
  renderLiberoWarning();
}

function createBenchAddButton() {
  const button = document.createElement("button");
  button.className = "bench-add-player";
  button.type = "button";
  button.textContent = "+";
  button.setAttribute("aria-label", "Add player");
  button.addEventListener("click", () => openPlayerDialog());
  return button;
}

function createBenchEditControl(playerId) {
  const control = document.createElement("span");
  control.className = "bench-edit";
  control.role = "button";
  control.tabIndex = 0;
  control.textContent = "✎";
  control.setAttribute("aria-label", `Edit ${fullName(playerById(playerId))}`);
  control.addEventListener("pointerdown", (event) => event.stopPropagation());
  control.addEventListener("click", (event) => {
    event.stopPropagation();
    openPlayerDialog(playerId);
  });
  control.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPlayerDialog(playerId);
    }
  });
  return control;
}

function createHomeRemoveControl(playerId) {
  const control = document.createElement("span");
  control.className = "home-remove";
  control.role = "button";
  control.tabIndex = 0;
  control.textContent = "×";
  control.setAttribute("aria-label", `Bench ${fullName(playerById(playerId))}`);
  control.addEventListener("pointerdown", (event) => event.stopPropagation());
  control.addEventListener("click", (event) => {
    event.stopPropagation();
    benchHomePlayer(playerId);
  });
  control.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      benchHomePlayer(playerId);
    }
  });
  return control;
}

function renderHomeOpenSlots() {
  court.querySelectorAll(".home-slot").forEach((slot) => slot.remove());
  if (!isHomePhase()) {
    closeSubPicker();
    return;
  }

  const occupied = occupiedHomeZoneIndexes();
  defaultZones.forEach((zone, zoneIndex) => {
    if (occupied.has(zoneIndex)) return;

    const slot = document.createElement("button");
    slot.className = "home-slot";
    slot.type = "button";
    slot.textContent = "+";
    slot.style.left = `${zone.x}%`;
    slot.style.top = `${zone.y}%`;
    slot.setAttribute("aria-label", `Add player to zone ${zoneIndex + 1}`);
    slot.addEventListener("click", () => openSubPicker(zoneIndex));
    court.append(slot);
  });
}

function benchHomePlayer(playerId) {
  if (!isHomePhase()) return;

  commitAction(() => {
    const placements = currentPlacements();
    const placement = placements[playerId];
    if (placement) {
      markHomeOverrideForSlot(nearestZoneIndex(placement));
    }
    delete placements[playerId];
    if (state.highlightedPlayerId === playerId) {
      state.highlightedPlayerId = null;
    }
    syncAfterHomeChange();
  });
  closeSubPicker();
  render();
}

function openSubPicker(zoneIndex) {
  pendingHomeSlot = zoneIndex;
  const benchPlayers = openHomeSlotPlayers();
  const zone = defaultZones[zoneIndex];
  subPicker.innerHTML = "";
  subPicker.hidden = false;
  subPicker.style.left = `${zone.x}%`;
  subPicker.style.top = `${zone.y}%`;

  const header = document.createElement("div");
  header.className = "sub-picker-header";
  const title = document.createElement("strong");
  title.textContent = `Add to zone ${zoneIndex + 1}`;
  const closeButton = document.createElement("button");
  closeButton.className = "sub-picker-close";
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close player picker");
  closeButton.addEventListener("click", closeSubPicker);
  header.append(title, closeButton);
  subPicker.append(header);

  if (!benchPlayers.length) {
    const empty = document.createElement("div");
    empty.className = "sub-picker-empty";
    empty.textContent = "No bench players";
    subPicker.append(empty);
    return;
  }

  benchPlayers.forEach((player) => {
    const option = document.createElement("button");
    const position = player.position || "Pos";
    option.type = "button";
    option.innerHTML = `
      <span>${player.number} ${initials(player)}</span>
      <small>${position}</small>
    `;
    option.setAttribute("aria-label", `Add ${fullName(player)}`);
    option.addEventListener("click", () => placeHomeSub(player.id));
    subPicker.append(option);
  });
}

function closeSubPicker() {
  pendingHomeSlot = null;
  subPicker.hidden = true;
  subPicker.innerHTML = "";
}

function placeHomeSub(playerId) {
  if (!isHomePhase() || pendingHomeSlot === null) return;

  commitAction(() => {
    const zone = defaultZones[pendingHomeSlot];
    currentPlacements()[playerId] = { x: zone.x, y: zone.y };
    markHomeOverrideForSlot(pendingHomeSlot);
    if (state.highlightedPlayerId && isBenchPlayer(state.highlightedPlayerId)) {
      state.highlightedPlayerId = null;
    }
    syncAfterHomeChange();
  });
  closeSubPicker();
  render();
}

function renderLiberoWarning() {
  const liberos = frontRowLiberos();
  liberoWarning.hidden = liberos.length === 0;
  liberoWarning.textContent = liberos.length
    ? `Libero front row: sub ${liberos.map((player) => initials(player)).join(", ")} before play.`
    : "";
}

function renderCoachCheck() {
  const currentWarnings = legalityWarnings();
  const currentNotes = advisoryNotes();
  const totalMessages = currentWarnings.length + currentNotes.length;
  coachCheckList.innerHTML = "";
  coachCheckCount.textContent = currentWarnings.length
    ? `${currentWarnings.length} issue${currentWarnings.length === 1 ? "" : "s"}${currentNotes.length ? `, ${currentNotes.length} note${currentNotes.length === 1 ? "" : "s"}` : ""}`
    : currentNotes.length
      ? `${currentNotes.length} note${currentNotes.length === 1 ? "" : "s"}`
      : "Ready";
  coachCheckCount.classList.toggle("has-issues", currentWarnings.length > 0);
  coachCheckCount.classList.toggle("has-notes", !currentWarnings.length && currentNotes.length > 0);
  if (totalMessages) {
    coachCheckExpanded = true;
  }
  coachCheck.classList.toggle("expanded", coachCheckExpanded && totalMessages > 0);
  coachCheckToggle.setAttribute("aria-expanded", String(coachCheckExpanded && totalMessages > 0));

  if (!totalMessages) {
    return;
  }

  currentWarnings.slice(0, 5).forEach((warning) => {
    const item = document.createElement("div");
    item.className = "coach-check-item";
    item.textContent = warning;
    coachCheckList.append(item);
  });

  currentNotes.slice(0, 3).forEach((note) => {
    const item = document.createElement("div");
    item.className = "coach-check-item note";
    item.textContent = note;
    coachCheckList.append(item);
  });
}

function renderLineupManager() {
  const active = activeLineup();
  lineupSelect.innerHTML = "";
  lineupLibrary.lineups.forEach((lineup) => {
    const option = document.createElement("option");
    option.value = lineup.id;
    option.textContent = lineup.name;
    lineupSelect.append(option);
  });
  if (active) {
    lineupSelect.value = active.id;
  }
  deleteLineupButton.disabled = lineupLibrary.lineups.length <= 1;
  const confirmingDelete = pendingDeleteLineupId === active?.id;
  deleteLineupButton.textContent = confirmingDelete ? "Confirm delete" : "Delete";
  deleteLineupButton.setAttribute("aria-label", confirmingDelete ? "Confirm delete lineup" : "Delete lineup");
}

function closeLineupMenu() {
  lineupMenu.hidden = true;
  lineupMenuButton.setAttribute("aria-expanded", "false");
}

function toggleLineupMenu() {
  const willOpen = lineupMenu.hidden;
  lineupMenu.hidden = !willOpen;
  lineupMenuButton.setAttribute("aria-expanded", String(willOpen));
}

function setLineupStatus(message) {
  lineupStatus.textContent = message;
  if (!message) return;
  window.clearTimeout(setLineupStatus.timeoutId);
  setLineupStatus.timeoutId = window.setTimeout(() => {
    lineupStatus.textContent = "";
  }, 3000);
}

function persistActiveLineupFromControls() {
  const active = activeLineup();
  if (!active) return null;
  active.data = currentLineupData();
  saveLineupLibrary();
  return active;
}

function openNewLineupDialog() {
  newLineupNameInput.value = "";
  newLineupImportPlayers.checked = false;
  newLineupImportPositions.checked = false;
  renderNewLineupImportOptions();
  newLineupDialog.hidden = false;
  newLineupNameInput.focus();
}

function closeNewLineupDialog() {
  newLineupDialog.hidden = true;
}

function openRenameLineupDialog() {
  const active = activeLineup();
  if (!active) return;
  renameLineupNameInput.value = active.name;
  renameLineupDialog.hidden = false;
  renameLineupNameInput.focus();
  renameLineupNameInput.select();
}

function closeRenameLineupDialog() {
  renameLineupDialog.hidden = true;
}

function renameActiveLineup(name) {
  const active = activeLineup();
  const nextName = name.trim();
  if (!active || !nextName) return;
  active.name = nextName;
  persistActiveLineupFromControls();
  closeRenameLineupDialog();
  renderLineupManager();
  setLineupStatus("Roster renamed.");
}

function renderNewLineupImportOptions() {
  newLineupImportSource.innerHTML = "";
  lineupLibrary.lineups.forEach((lineup) => {
    const option = document.createElement("option");
    option.value = lineup.id;
    option.textContent = lineup.name;
    newLineupImportSource.append(option);
  });
  newLineupImportSource.value = lineupLibrary.activeId;
}

function createLineupDataFromNewDialog() {
  const source = lineupLibrary.lineups.find((lineup) => lineup.id === newLineupImportSource.value) ?? activeLineup();
  const data = defaultLineupData();

  if (newLineupImportPositions.checked && source) {
    return cloneLineupData(source.data);
  }

  if (newLineupImportPlayers.checked && source) {
    data.players = cloneLineupData(source.data.players);
    data.placements = {};
  }

  return data;
}

function createNewLineup(name) {
  persistActiveLineupFromControls();

  const lineup = {
    id: makeId(),
    name: name.trim() || `Lineup ${lineupLibrary.lineups.length + 1}`,
    data: createLineupDataFromNewDialog(),
  };
  lineupLibrary.lineups.push(lineup);
  lineupLibrary.activeId = lineup.id;
  saveLineupLibrary();
  applyLineupData(lineup.data);
  undoStack.length = 0;
  updateUndoButton();
  closeNewLineupDialog();
  render();
  setLineupStatus("New lineup created.");
}

function openPlayerDialog(playerId = null) {
  const player = playerId ? playerById(playerId) : null;
  editingPlayerId = player?.id ?? null;
  pendingDeletePlayerId = null;
  playerDialogTitle.textContent = player ? "Edit player" : "Add player";
  savePlayerDialogButton.textContent = player ? "Save player" : "Add player";
  deletePlayerDialogButton.hidden = !player;
  deletePlayerDialogButton.textContent = "Delete";
  playerFirstNameInput.value = player?.firstName ?? "";
  playerLastNameInput.value = player?.lastName ?? "";
  playerNumberInput.value = player?.number ?? "";
  playerPositionInput.value = player?.position ?? "";
  addPlayerDialog.hidden = false;
  playerFirstNameInput.focus();
}

function closePlayerDialog() {
  editingPlayerId = null;
  pendingDeletePlayerId = null;
  addPlayerDialog.hidden = true;
}

function switchLineup(lineupId) {
  const next = lineupLibrary.lineups.find((lineup) => lineup.id === lineupId);
  if (!next || next.id === lineupLibrary.activeId) return;

  pendingDeleteLineupId = null;
  pendingDeletePlayerId = null;
  persistActiveLineupFromControls();
  lineupLibrary.activeId = next.id;
  applyLineupData(next.data);
  undoStack.length = 0;
  updateUndoButton();
  saveLineupLibrary();
  closeSubPicker();
  render();
}

function deleteCurrentLineup() {
  const active = activeLineup();
  if (!active || lineupLibrary.lineups.length <= 1) return;

  if (pendingDeleteLineupId !== active.id) {
    pendingDeleteLineupId = active.id;
    renderLineupManager();
    setLineupStatus("Tap check to delete this roster.");
    return;
  }

  const deletedName = active.name;
  lineupLibrary.lineups = lineupLibrary.lineups.filter((lineup) => lineup.id !== active.id);
  lineupLibrary.activeId = lineupLibrary.lineups[0].id;
  pendingDeleteLineupId = null;
  applyLineupData(activeLineup().data);
  undoStack.length = 0;
  updateUndoButton();
  saveLineupLibrary();
  render();
  setLineupStatus(`${deletedName} deleted.`);
}

function base64UrlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function base64UrlDecode(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function sharePayloadForActiveLineup() {
  const active = activeLineup();
  return {
    version: 1,
    name: active?.name || "Shared lineup",
    data: currentLineupData(),
  };
}

function shareLinkForActiveLineup() {
  const url = new URL(window.location.href);
  url.hash = `lineup=${base64UrlEncode(JSON.stringify(sharePayloadForActiveLineup()))}`;
  return url.toString();
}

function openShareLineupDialog(link) {
  shareLineupText.value = link;
  shareLineupDialog.hidden = false;
  shareLineupText.focus();
  shareLineupText.select();
}

function closeShareLineupDialog() {
  shareLineupDialog.hidden = true;
}

async function shareCurrentLineup() {
  persistActiveLineupFromControls();
  const link = shareLinkForActiveLineup();

  if (navigator.share) {
    try {
      await navigator.share({
        title: activeLineup()?.name || "Volley lineup",
        text: "Volley lineup",
        url: link,
      });
      setLineupStatus("Share sheet opened.");
      return;
    } catch {
      // Fall back if sharing is unavailable or canceled.
    }
  }

  try {
    await navigator.clipboard.writeText(link);
    setLineupStatus("Share link copied.");
  } catch {
    openShareLineupDialog(link);
    setLineupStatus("Copy the link from the share box.");
  }
}

function importSharedLineupFromUrl() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash.startsWith("lineup=")) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(hash.slice("lineup=".length)));
    const lineup = {
      id: makeId(),
      name: payload.name || "Shared lineup",
      data: normalizeLineupData(payload.data ?? defaultLineupData()),
    };
    lineupLibrary.lineups.push(lineup);
    lineupLibrary.activeId = lineup.id;
    applyLineupData(lineup.data);
    saveLineupLibrary();
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setLineupStatus("Shared lineup imported.");
    return true;
  } catch {
    setLineupStatus("Could not open shared lineup.");
    return false;
  }
}

function render() {
  renderLineupManager();
  renderTabs();
  renderPlayers();
  renderCoachCheck();
}

function playRotationCue() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  court.classList.remove("rotation-pulse");
  void court.offsetWidth;
  court.classList.add("rotation-pulse");
  window.clearTimeout(playRotationCue.timeoutId);
  playRotationCue.timeoutId = window.setTimeout(() => {
    court.classList.remove("rotation-pulse");
  }, 720);
}

function snapshotCourtChips() {
  const rects = new Map();
  courtPlayers.querySelectorAll(".player-chip.on-court").forEach((chip) => {
    rects.set(chip.dataset.playerId, chip.getBoundingClientRect());
  });
  return rects;
}

function renderWithMovement(updateState) {
  const beforeRects = snapshotCourtChips();
  updateState();
  render();
  animateMovedChips(beforeRects);
}

function animateMovedChips(beforeRects) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  requestAnimationFrame(() => {
    courtPlayers.querySelectorAll(".player-chip.on-court").forEach((chip) => {
      const before = beforeRects.get(chip.dataset.playerId);
      if (!before) return;

      const after = chip.getBoundingClientRect();
      const deltaX = before.left - after.left;
      const deltaY = before.top - after.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

      chip.getAnimations().forEach((animation) => animation.cancel());
      chip.classList.add("moving");
      const animation = chip.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px) translate(-50%, -50%)` },
          { transform: "translate(0, 0) translate(-50%, -50%)" },
        ],
        {
          duration: 1000,
          easing: "cubic-bezier(0.2, 0.85, 0.25, 1)",
        },
      );
      animation.finished.then(
        () => chip.classList.remove("moving"),
        () => chip.classList.remove("moving"),
      );
    });
  });
}

function pointInRect(event, rect) {
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function startDrag(event) {
  const chip = event.currentTarget;
  const playerId = chip.dataset.playerId;
  const placements = currentPlacements();
  const existing = placements[playerId];

  const courtRect = court.getBoundingClientRect();
  const pointerX = clamp(((event.clientX - courtRect.left) / courtRect.width) * 100, placementBounds.minX, placementBounds.maxX);
  const pointerY = clamp(((event.clientY - courtRect.top) / courtRect.height) * 100, placementBounds.minY, placementBounds.maxY);
  const x = existing?.x ?? pointerX;
  const y = existing?.y ?? pointerY;

  event.preventDefault();
  chip.classList.add("dragging", "on-court");

  if (!chip.parentElement.isSameNode(courtPlayers)) {
    courtPlayers.append(chip);
  }

  chip.setPointerCapture(event.pointerId);
  chip.style.left = `${x}%`;
  chip.style.top = `${y}%`;

  drag = {
    chip,
    playerId,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    hadPlacement: Boolean(existing),
    moved: false,
  };

  moveDrag(event);
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
}

function moveDrag(event) {
  if (!drag) return;

  const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
  if (distance > 6) {
    drag.moved = true;
  }

  const courtRect = court.getBoundingClientRect();
  const x = clamp(((event.clientX - courtRect.left) / courtRect.width) * 100, placementBounds.minX, placementBounds.maxX);
  const y = clamp(((event.clientY - courtRect.top) / courtRect.height) * 100, placementBounds.minY, placementBounds.maxY);
  drag.chip.style.left = `${x}%`;
  drag.chip.style.top = `${y}%`;

  const overBench = pointInRect(event, benchZone.getBoundingClientRect());
  benchZone.classList.toggle("drop-target", overBench);
}

function endDrag(event) {
  if (!drag) return;

  pushUndo();
  const placements = currentPlacements();
  const overBench = pointInRect(event, benchZone.getBoundingClientRect());
  const courtRect = court.getBoundingClientRect();
  const overCourt = pointInRect(event, courtRect);

  drag.chip.classList.remove("dragging");
  benchZone.classList.remove("drop-target");

  let removedFromCourt = false;

  if (isHomePhase()) {
    const finalX = clamp(((event.clientX - courtRect.left) / courtRect.width) * 100, placementBounds.minX, placementBounds.maxX);
    const finalY = clamp(((event.clientY - courtRect.top) / courtRect.height) * 100, placementBounds.minY, placementBounds.maxY);

    if (!drag.moved) {
      if (!drag.hadPlacement) {
        delete placements[drag.playerId];
        removedFromCourt = true;
      }
      state.highlightedPlayerId = state.highlightedPlayerId === drag.playerId ? null : drag.playerId;
    } else if (overBench || !overCourt) {
      const existingPlacement = placements[drag.playerId];
      if (existingPlacement) {
        markHomeOverrideForSlot(nearestZoneIndex(existingPlacement));
      }
      delete placements[drag.playerId];
      removedFromCourt = true;
      if (state.highlightedPlayerId === drag.playerId) {
        state.highlightedPlayerId = null;
      }
      syncAfterHomeChange();
    } else {
      const zoneIndex = nearestZoneIndex({ x: finalX, y: finalY });
      const occupiedBy = playerInHomeZone(zoneIndex, drag.playerId);
      const existingPlacement = placements[drag.playerId];
      if (!occupiedBy) {
        placements[drag.playerId] = { ...defaultZones[zoneIndex] };
        markHomeOverrideForSlot(zoneIndex);
        if (existingPlacement) {
          markHomeOverrideForSlot(nearestZoneIndex(existingPlacement));
        }
        syncAfterHomeChange();
      } else if (existingPlacement) {
        const previousZoneIndex = nearestZoneIndex(existingPlacement);
        placements[drag.playerId] = { ...defaultZones[zoneIndex] };
        placements[occupiedBy] = { ...defaultZones[previousZoneIndex] };
        markHomeOverrideForSlot(zoneIndex);
        markHomeOverrideForSlot(previousZoneIndex);
        syncAfterHomeChange();
      } else {
        delete placements[drag.playerId];
        removedFromCourt = true;
      }
    }
  } else if (!drag.moved) {
    if (!drag.hadPlacement) {
      delete placements[drag.playerId];
      removedFromCourt = true;
    }
    state.highlightedPlayerId = state.highlightedPlayerId === drag.playerId ? null : drag.playerId;
  } else if (overBench || !overCourt) {
    markPhaseEdited();
    delete placements[drag.playerId];
    removedFromCourt = true;
    if (state.highlightedPlayerId === drag.playerId) {
      state.highlightedPlayerId = null;
    }
  } else {
    markPhaseEdited();
    placements[drag.playerId] = {
      x: clamp(((event.clientX - courtRect.left) / courtRect.width) * 100, placementBounds.minX, placementBounds.maxX),
      y: clamp(((event.clientY - courtRect.top) / courtRect.height) * 100, placementBounds.minY, placementBounds.maxY),
    };
  }

  try {
    drag.chip.releasePointerCapture(drag.pointerId);
  } catch {
    // Some browsers release capture automatically on pointer cancel.
  }

  drag = null;
  window.removeEventListener("pointermove", moveDrag);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);
  saveState();
  render();
}

addPlayerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const firstName = playerFirstNameInput.value.trim();
  const lastName = playerLastNameInput.value.trim();
  const number = normalizePlayerNumber(playerNumberInput.value);
  const position = playerPositionInput.value;
  if (!firstName && !lastName && !number) return;

  commitAction(() => {
    const editedPlayer = editingPlayerId ? playerById(editingPlayerId) : null;
    if (editedPlayer) {
      editedPlayer.firstName = firstName || "Player";
      editedPlayer.lastName = lastName;
      editedPlayer.number = number || normalizePlayerNumber(editedPlayer.number);
      editedPlayer.position = position;
      return;
    }

    state.players.push({
      id: makeId(),
      firstName: firstName || "Player",
      lastName,
      number: number || normalizePlayerNumber(state.players.length + 1, "0"),
      position,
    });
  });
  closePlayerDialog();
  render();
});

playerNumberInput.addEventListener("input", () => {
  playerNumberInput.value = playerNumberInput.value.replace(/\D/g, "").slice(0, 2);
});

cancelAddPlayerButton.addEventListener("click", () => {
  closePlayerDialog();
});

deletePlayerDialogButton.addEventListener("click", () => {
  if (!editingPlayerId) return;
  if (pendingDeletePlayerId !== editingPlayerId) {
    pendingDeletePlayerId = editingPlayerId;
    deletePlayerDialogButton.textContent = "Confirm delete";
    return;
  }
  const playerId = editingPlayerId;
  closePlayerDialog();
  deletePlayer(playerId);
});

addPlayerDialog.addEventListener("click", (event) => {
  if (event.target === addPlayerDialog) {
    closePlayerDialog();
  }
});

undoButton.addEventListener("click", undoLastAction);
coachCheckToggle.addEventListener("click", () => {
  const hasMessages = coachCheckList.children.length > 0;
  if (!hasMessages) return;
  coachCheckExpanded = !coachCheckExpanded;
  coachCheck.classList.toggle("expanded", coachCheckExpanded);
  coachCheckToggle.setAttribute("aria-expanded", String(coachCheckExpanded));
});
lineupSelect.addEventListener("change", () => {
  closeLineupMenu();
  switchLineup(lineupSelect.value);
});
lineupMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleLineupMenu();
});
lineupMenu.addEventListener("click", (event) => event.stopPropagation());
newLineupButton.addEventListener("click", () => {
  closeLineupMenu();
  openNewLineupDialog();
});
renameLineupButton.addEventListener("click", () => {
  closeLineupMenu();
  openRenameLineupDialog();
});
shareLineupButton.addEventListener("click", () => {
  closeLineupMenu();
  shareCurrentLineup();
});
deleteLineupButton.addEventListener("click", () => {
  if (pendingDeleteLineupId === activeLineup()?.id) {
    closeLineupMenu();
  }
  deleteCurrentLineup();
});
document.addEventListener("click", closeLineupMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLineupMenu();
  }
});
cancelNewLineupButton.addEventListener("click", closeNewLineupDialog);
newLineupDialog.addEventListener("click", (event) => {
  if (event.target === newLineupDialog) {
    closeNewLineupDialog();
  }
});
newLineupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createNewLineup(newLineupNameInput.value);
});
cancelRenameLineupButton.addEventListener("click", closeRenameLineupDialog);
renameLineupDialog.addEventListener("click", (event) => {
  if (event.target === renameLineupDialog) {
    closeRenameLineupDialog();
  }
});
renameLineupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  renameActiveLineup(renameLineupNameInput.value);
});
copyShareLineupButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareLineupText.value);
    closeShareLineupDialog();
    setLineupStatus("Share link copied.");
  } catch {
    shareLineupText.focus();
    shareLineupText.select();
    setLineupStatus("Select and copy the link.");
  }
});
closeShareLineupButton.addEventListener("click", closeShareLineupDialog);
shareLineupDialog.addEventListener("click", (event) => {
  if (event.target === shareLineupDialog) {
    closeShareLineupDialog();
  }
});

function deletePlayer(playerId) {
  commitAction(() => {
    state.players = state.players.filter((player) => player.id !== playerId);
    if (state.highlightedPlayerId === playerId) {
      state.highlightedPlayerId = null;
    }
    Object.values(state.placements).forEach((placements) => {
      delete placements[playerId];
    });
  });
  render();
}

renderPositionOptions(playerPositionInput);
loadLineupLibrary();
importSharedLineupFromUrl();
upgradeLegacyPhaseDefaults();

for (let rotation = 1; rotation <= 6; rotation += 1) {
  seedRotation(rotation);
}

syncHomeRotations();
saveState();
render();
