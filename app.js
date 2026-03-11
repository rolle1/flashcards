// Integros core: decks + localStorage + spaced helpers
// This file contains the core logic for managing decks, spaced repetition
// statistics, and persistence in localStorage.  It now includes deck
// metadata and helpers to reset statistics.

(function () {
  const STORAGE_KEY = "integros-flashcards-v1";

  // No default decks — new devices start with a clean library.
  // Import decks via the Explore page JSON tools or AI generator.
  const defaultDecks = {};

  // Metadata for curated decks — empty now that default decks have been removed.
  // Custom decks fall back to generic display values in explore.js.
  const deckMetadata = {};

  let stateCache = null;

  function loadState() {
    if (stateCache) return stateCache;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        stateCache = { decks: defaultDecks, stats: {} };
        return stateCache;
      }
      const parsed = JSON.parse(raw);
      if (!parsed.decks || typeof parsed.decks !== "object") {
        stateCache = { decks: defaultDecks, stats: {} };
      } else {
        stateCache = {
          decks: parsed.decks,
          stats: parsed.stats || {},
        };
      }
    } catch (e) {
      stateCache = { decks: defaultDecks, stats: {} };
    }
    return stateCache;
  }

  function saveState() {
    if (!stateCache) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateCache));
    } catch (e) {
      // ignore storage errors
    }
  }

  function getDecks() {
    return loadState().decks;
  }

  function replaceDecks(newDecks) {
    const s = loadState();
    s.decks = newDecks;
    s.stats = {};
    saveState();
  }

  // Merge decks into existing state (used by Explore + JSON import)
  function mergeDecks(newDecks) {
    const s = loadState();
    const decks = s.decks || {};
    Object.keys(newDecks).forEach((name) => {
      decks[name] = newDecks[name];
    });
    s.decks = decks;
    saveState();
  }

  function getDeckStats(deckName, deckLength) {
    const s = loadState();
    if (!s.stats[deckName]) {
      s.stats[deckName] = {
        correct: 0,
        total: 0,
        lastIndex: 0,
        boxes: new Array(deckLength).fill(1),
      };
    } else if (!Array.isArray(s.stats[deckName].boxes)) {
      s.stats[deckName].boxes = new Array(deckLength).fill(1);
    } else if (s.stats[deckName].boxes.length !== deckLength) {
      const boxes = s.stats[deckName].boxes.slice(0, deckLength);
      while (boxes.length < deckLength) boxes.push(1);
      s.stats[deckName].boxes = boxes;
    }
    return s.stats[deckName];
  }

  function updateDeckStats(deckName, deckLength, updater) {
    const stats = getDeckStats(deckName, deckLength);
    updater(stats);
    saveState();
    return stats;
  }

  function recordAnswer(deckName, deckLength, cardIndex, correct, spacedMode) {
    return updateDeckStats(deckName, deckLength, function (st) {
      st.total += 1;
      if (correct) st.correct += 1;
      st.lastIndex = cardIndex;
      if (spacedMode) {
        const boxes = st.boxes;
        const current = boxes[cardIndex] || 1;
        boxes[cardIndex] = correct ? Math.min(4, current + 1) : 1;
      }
    });
  }

  function getLastIndex(deckName, deckLength) {
    const stats = getDeckStats(deckName, deckLength);
    if (typeof stats.lastIndex !== "number") return 0;
    if (stats.lastIndex < 0 || stats.lastIndex >= deckLength) return 0;
    return stats.lastIndex;
  }

  function chooseSpacedIndex(deckName, deckLength) {
    const stats = getDeckStats(deckName, deckLength);
    const boxes = stats.boxes;
    const weightsForBox = [0, 4, 2, 1, 1];
    const bag = [];
    for (let i = 0; i < deckLength; i += 1) {
      const box = boxes[i] || 1;
      const w = weightsForBox[box] || 1;
      for (let k = 0; k < w; k += 1) {
        bag.push(i);
      }
    }
    if (!bag.length) {
      return Math.floor(Math.random() * deckLength);
    }
    const pick = bag[Math.floor(Math.random() * bag.length)];
    return pick;
  }

  function getStatsSnapshot(deckName, deckLength) {
    const st = getDeckStats(deckName, deckLength);
    return { correct: st.correct, total: st.total };
  }

  function deleteDeck(deckName) {
    const s = loadState();
    if (!s.decks[deckName]) {
      return { ok: false, reason: "Deck not found." };
    }
    delete s.decks[deckName];
    if (s.stats[deckName]) delete s.stats[deckName];
    saveState();
    return { ok: true };
  }

  function renameDeck(oldName, newName) {
    const s = loadState();
    const trimmed = (newName || "").trim();
    if (!s.decks[oldName]) {
      return { ok: false, reason: "Deck not found." };
    }
    if (!trimmed) {
      return { ok: false, reason: "Name cannot be empty." };
    }
    if (trimmed === oldName) {
      return { ok: true };
    }
    if (s.decks[trimmed]) {
      return { ok: false, reason: "A deck with that name already exists." };
    }
    s.decks[trimmed] = s.decks[oldName];
    delete s.decks[oldName];
    if (s.stats[oldName]) {
      s.stats[trimmed] = s.stats[oldName];
      delete s.stats[oldName];
    }
    saveState();
    return { ok: true };
  }

  // Return deck metadata to callers.  Unknown decks return undefined.
  function getDeckMetadata() {
    return deckMetadata;
  }

  // --- Card flagging ---------------------------------------------------------
  // Flags are stored as an array of card indices inside the deck's stats
  // object: stats[deckName].flagged = [0, 3, 7].  They survive resets only
  // when resetStats() is called without touching the flagged array — flags
  // represent "I'm not confident" rather than spaced-rep progress, so they
  // are intentionally kept across progress resets unless explicitly cleared.

  function _getFlaggedSet(deckName, deckLength) {
    const st = getDeckStats(deckName, deckLength);
    if (!Array.isArray(st.flagged)) st.flagged = [];
    return st.flagged;
  }

  function flagCard(deckName, deckLength, cardIndex) {
    const s = loadState();
    const st = getDeckStats(deckName, deckLength);
    if (!Array.isArray(st.flagged)) st.flagged = [];
    if (!st.flagged.includes(cardIndex)) st.flagged.push(cardIndex);
    saveState();
  }

  function unflagCard(deckName, deckLength, cardIndex) {
    const st = getDeckStats(deckName, deckLength);
    if (!Array.isArray(st.flagged)) { st.flagged = []; saveState(); return; }
    st.flagged = st.flagged.filter(function (i) { return i !== cardIndex; });
    saveState();
  }

  function isCardFlagged(deckName, deckLength, cardIndex) {
    const st = getDeckStats(deckName, deckLength);
    if (!Array.isArray(st.flagged)) return false;
    return st.flagged.includes(cardIndex);
  }

  // Returns an array of card indices that are flagged for the given deck.
  function getFlaggedIndices(deckName, deckLength) {
    return _getFlaggedSet(deckName, deckLength).slice();
  }

  // Reset spaced repetition statistics.  If a deck name is provided, only
  // that deck's stats are cleared.  Otherwise, all stats are cleared.
  function resetStats(deckName) {
    const s = loadState();
    if (!deckName) {
      s.stats = {};
    } else {
      delete s.stats[deckName];
    }
    saveState();
  }

  // Allow external modules (e.g. drive-sync.js) to invalidate the state cache
  function _resetCache() {
    stateCache = null;
  }

  // Export the API on the global namespace
  window.Integros = {
    getDecks,
    replaceDecks,
    mergeDecks,
    getDeckStats,
    getStatsSnapshot,
    recordAnswer,
    getLastIndex,
    chooseSpacedIndex,
    deleteDeck,
    renameDeck,
    getDeckMetadata,
    resetStats,
    flagCard,
    unflagCard,
    isCardFlagged,
    getFlaggedIndices,
    _resetCache,
  };
})();