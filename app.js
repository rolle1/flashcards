// Integros core: decks + localStorage + spaced helpers
(function () {
  const STORAGE_KEY = "integros-flashcards-v1";

  const defaultDecks = {
    "Example Deck": [
      { front: "What is the capital of France?", back: "Paris" },
      { front: "2 + 2 = ?", back: "4" },
      { front: "HTTP stands for?", back: "HyperText Transfer Protocol" }
    ],
    "AZ-900 Basics": [
      { front: "What is Azure?", back: "Microsoft's cloud platform." },
      { front: "What does IaaS stand for?", back: "Infrastructure as a Service." },
      { front: "What does PaaS stand for?", back: "Platform as a Service." },
      { front: "What does SaaS stand for?", back: "Software as a Service." }
    ],
    "CHAMP Hardware": [
      { front: "What does ITAM stand for?", back: "IT Asset Management." },
      { front: "Main goal of hardware lifecycle?", back: "Control cost, risk, and value across the hardware life." },
      { front: "Example of hardware asset", back: "Laptop, desktop, server, switch, mobile device." }
    ]
  };

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
          stats: parsed.stats || {}
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
      // ignore
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

  function getDeckStats(deckName, deckLength) {
    const s = loadState();
    if (!s.stats[deckName]) {
      s.stats[deckName] = {
        correct: 0,
        total: 0,
        lastIndex: 0,
        boxes: new Array(deckLength).fill(1)
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
        if (correct) {
          boxes[cardIndex] = Math.min(4, current + 1);
        } else {
          boxes[cardIndex] = 1;
        }
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

    // move deck
    s.decks[trimmed] = s.decks[oldName];
    delete s.decks[oldName];

    // move stats if present
    if (s.stats[oldName]) {
      s.stats[trimmed] = s.stats[oldName];
      delete s.stats[oldName];
    }

    saveState();
    return { ok: true };
  }


  window.Integros = {
    getDecks: getDecks,
    replaceDecks: replaceDecks,
    getDeckStats: getDeckStats,
    getStatsSnapshot: getStatsSnapshot,
    recordAnswer: recordAnswer,
    getLastIndex: getLastIndex,
    chooseSpacedIndex: chooseSpacedIndex,
    renameDeck: renameDeck
  };
})();
