// Study page logic.  Handles card navigation, spaced repetition,
// multiple-choice and type modes, and progress reset.  It also
// remembers the last selected deck and study mode in localStorage
// and persists them across sessions.

(function () {
  const deckSelect = document.getElementById("deckSelect");
  const modeSelect = document.getElementById("modeSelect");
  const cardEl = document.getElementById("card");
  const cardText = document.getElementById("cardText");
  const cardLabel = document.getElementById("cardLabel");
  const cardIndexEl = document.getElementById("cardIndex");
  const cardTotalEl = document.getElementById("cardTotal");
  // const cardDeckNameEl = document.getElementById("cardDeckName"); // removed: we no longer show deck name on card
  const scoreText = document.getElementById("scoreText");

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const flipBtn = document.getElementById("flipBtn");

  const mcRow = document.getElementById("mcRow");
  const mcButtons = Array.prototype.slice.call(
    document.querySelectorAll(".mc-option")
  );

  // Reset button for clearing progress
  const resetBtn = document.getElementById("resetBtn");

  // Flag button (on the card) and flagged-only filter toggle
  const flagBtn = document.getElementById("flagBtn");
  const flaggedOnlyBtn = document.getElementById("flaggedOnlyBtn");

  // Progress bar elements
  const progressBar = document.getElementById("progressBar");
  const progressCorrect = document.getElementById("progressCorrect");
  const progressLabel = document.getElementById("progressLabel");

  let deckName = "";
  let deck = [];       // the active card list (may be filtered to flagged only)
  let fullDeck = [];   // always the complete deck from storage
  let index = 0;
  let showingBack = false;
  let mode = "normal";
  let mcCorrectOptionIndex = null;
  let flaggedOnly = false;  // whether we are filtering to flagged cards only

  // Swipe tracking
  let touchStartX = 0;
  let touchEndX = 0;
  let touchStartY = 0;
  let touchEndY = 0;

  function handleGesture() {
    const dx = touchEndX - touchStartX;
    const dy = Math.abs(touchEndY - touchStartY);

    // Ignore vertical scroll gestures
    if (dy > 60) return;

    // Swipe right: previous
    if (dx > 60) { move(-1); return; }

    // Swipe left: next
    if (dx < -60) { move(1); return; }

    // Tap: flip
    if (Math.abs(dx) < 10 && dy < 10) {
      flipCard();
    }
  }

  cardEl.addEventListener("touchstart", function (e) {
    const t = e.changedTouches[0];
    touchStartX = t.screenX;
    touchStartY = t.screenY;
  });

  cardEl.addEventListener("touchend", function (e) {
    const t = e.changedTouches[0];
    touchEndX = t.screenX;
    touchEndY = t.screenY;
    handleGesture();
  });

  function loadFromUrlParam() {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("deck");
    if (!d) return null;
    return d;
  }

  // Load previously selected deck and mode from localStorage
  function loadFromLocalStorage(decks) {
    try {
      const lastDeck = window.localStorage.getItem("integros-lastDeck");
      const lastMode = window.localStorage.getItem("integros-lastMode");
      if (lastDeck && decks[lastDeck]) {
        deckName = lastDeck;
      }
      if (lastMode && ["normal", "mc"].indexOf(lastMode) !== -1) {
        mode = lastMode;
      }
    } catch (err) {
      // ignore storage errors
    }
  }

  function initDeckSelect() {
    const decks = Integros.getDecks();
    const keys = Object.keys(decks);

    deckSelect.innerHTML = "";
    keys.forEach(function (name) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      deckSelect.appendChild(opt);
    });

    const urlDeck = loadFromUrlParam();
    if (urlDeck && decks[urlDeck]) {
      deckName = urlDeck;
    } else {
      // Load last saved deck and mode
      loadFromLocalStorage(decks);
      if (!deckName) {
        deckName = keys[0] || "";
      }
    }

    deckSelect.value = deckName;
    fullDeck = decks[deckName] || [];
    applyDeckFilter();

    const last = Integros.getLastIndex(deckName, fullDeck.length);
    index = last < deck.length ? last : 0;
    updateScoreDisplay();
  }

  // Build `deck` from `fullDeck` based on the flaggedOnly toggle.
  // When flaggedOnly is on and no cards are flagged, keeps full deck so
  // the user isn't stranded on a blank card.
  function applyDeckFilter() {
    if (!flaggedOnly) {
      deck = fullDeck;
      return;
    }
    const flaggedIndices = Integros.getFlaggedIndices(deckName, fullDeck.length);
    const filtered = fullDeck.filter(function (_, i) {
      return flaggedIndices.includes(i);
    });
    deck = filtered.length ? filtered : fullDeck;
    if (!filtered.length && flaggedOnlyBtn) {
      showToast && showToast("No flagged cards — showing full deck.", false);
    }
  }

  function updateScoreDisplay() {
    const stats = Integros.getStatsSnapshot(deckName, fullDeck.length);
    scoreText.textContent = stats.correct + " right / " + stats.total + " total";
  }

  function updateProgressBar() {
    if (!progressBar || !progressCorrect || !progressLabel) return;
    const total = deck.length;
    if (!total) {
      progressBar.style.width = "0%";
      progressCorrect.style.width = "0%";
      progressLabel.textContent = "0 / 0";
      return;
    }
    // Position fill — how far through the deck we are
    const positionPct = ((index + 1) / total) * 100;
    progressBar.style.width = positionPct + "%";

    // Correct fill — proportion of total answered that were correct
    const stats = Integros.getStatsSnapshot(deckName, fullDeck.length);
    const correctPct = stats.total > 0
      ? Math.min((stats.correct / total) * 100, positionPct)
      : 0;
    progressCorrect.style.width = correctPct + "%";

    progressLabel.textContent = (index + 1) + " / " + total;
  }

  function renderCard() {
    if (!deck.length) {
      cardText.textContent =
        "No cards in this deck.\nGo to Explore and load some.";
      cardLabel.textContent = "Empty";
      cardIndexEl.textContent = "0";
      cardTotalEl.textContent = "0";
      if (flagBtn) { flagBtn.classList.remove("active"); }
      if (cardEl) { cardEl.classList.remove("is-flagged"); }
      updateProgressBar();
      return;
    }

    const current = deck[index];
    cardText.textContent = showingBack ? current.back : current.front;
    cardLabel.textContent = showingBack ? "Answer" : "Question";
    cardIndexEl.textContent = String(index + 1);
    cardTotalEl.textContent = String(deck.length);

    // Resolve the true index in fullDeck for flag state (filter may shift indices)
    const trueIndex = fullDeck.indexOf(current);
    const flagged = trueIndex !== -1 && Integros.isCardFlagged(deckName, fullDeck.length, trueIndex);
    if (flagBtn) flagBtn.classList.toggle("active", flagged);
    if (cardEl) cardEl.classList.toggle("is-flagged", flagged);

    updateScoreDisplay();
    updateProgressBar();
    refreshModeUI();
  }

  function setMode(newMode) {
    mode = newMode;
    try {
      window.localStorage.setItem("integros-lastMode", mode);
    } catch (err) {
      // ignore
    }
    if (mode === "mc") {
      mcRow.style.display = "flex";
      prepareMultipleChoiceOptions();
    } else {
      // normal
      mcRow.style.display = "none";
    }
  }

  function refreshModeUI() {
    if (mode === "mc") {
      prepareMultipleChoiceOptions();
    }
  }

  function flipCard() {
    if (!deck.length) return;
    showingBack = !showingBack;
    renderCard();
  }

  function move(delta) {
    if (!deck.length) return;
    const len = deck.length;
    index = (index + delta + len) % len;
    showingBack = false;
    renderCard();
  }

  function record(correct) {
    if (!deck.length) return;
    Integros.recordAnswer(deckName, fullDeck.length, index, correct, false);
    updateScoreDisplay();
    move(1);
  }

  function prepareMultipleChoiceOptions() {
    if (!deck.length) return;
    const correctCard = deck[index];
    const all = deck.map(function (c) {
      return c.back;
    });
    const choices = [];
    const used = new Set();
    choices.push(correctCard.back);
    used.add(correctCard.back);
    while (choices.length < 4 && choices.length < all.length) {
      const candidate = all[Math.floor(Math.random() * all.length)];
      if (!used.has(candidate)) {
        used.add(candidate);
        choices.push(candidate);
      }
    }
    while (choices.length < 4) {
      choices.push("N/A");
    }
    // shuffle
    for (let i = choices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = choices[i];
      choices[i] = choices[j];
      choices[j] = tmp;
    }
    mcCorrectOptionIndex = choices.indexOf(correctCard.back);
    mcButtons.forEach(function (btn, idx) {
      btn.textContent = choices[idx];
      btn.classList.remove("btn-good", "btn-bad");
    });
  }

  function handleMultipleChoiceClick(selectedIndex) {
    if (mcCorrectOptionIndex == null) return;
    const correct = selectedIndex === mcCorrectOptionIndex;
    mcButtons.forEach(function (btn, idx) {
      btn.classList.remove("btn-good", "btn-bad");
      if (idx === mcCorrectOptionIndex) {
        btn.classList.add("btn-good");
      } else if (idx === selectedIndex && !correct) {
        btn.classList.add("btn-bad");
      }
    });
    record(correct);
  }

  // Click listeners
  cardEl.addEventListener("click", flipCard);
  flipBtn.addEventListener("click", flipCard);
  prevBtn.addEventListener("click", function () { move(-1); });
  nextBtn.addEventListener("click", function () { move(1); });
  deckSelect.addEventListener("change", function (e) {
    const decks = Integros.getDecks();
    deckName = e.target.value;
    fullDeck = decks[deckName] || [];
    applyDeckFilter();
    index = Integros.getLastIndex(deckName, fullDeck.length);
    if (index >= deck.length) index = 0;
    showingBack = false;
    renderCard();
    // Persist deck
    try {
      window.localStorage.setItem("integros-lastDeck", deckName);
    } catch (err) {
      // ignore
    }
  });

  // Flag button — toggle flag on the current card
  if (flagBtn) {
    flagBtn.addEventListener("click", function (e) {
      e.stopPropagation(); // don't flip the card
      if (!deck.length) return;
      const current = deck[index];
      const trueIndex = fullDeck.indexOf(current);
      if (trueIndex === -1) return;
      const alreadyFlagged = Integros.isCardFlagged(deckName, fullDeck.length, trueIndex);
      if (alreadyFlagged) {
        Integros.unflagCard(deckName, fullDeck.length, trueIndex);
      } else {
        Integros.flagCard(deckName, fullDeck.length, trueIndex);
      }
      renderCard();
    });
  }

  // Flagged-only toggle
  if (flaggedOnlyBtn) {
    flaggedOnlyBtn.addEventListener("click", function () {
      flaggedOnly = !flaggedOnly;
      flaggedOnlyBtn.classList.toggle("active", flaggedOnly);
      flaggedOnlyBtn.setAttribute("aria-pressed", String(flaggedOnly));
      applyDeckFilter();
      index = 0;
      showingBack = false;
      renderCard();
    });
  }
  modeSelect.addEventListener("change", function (e) {
    setMode(e.target.value);
    renderCard();
  });
  mcButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      handleMultipleChoiceClick(idx);
    });
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.code === "Space") {
      e.preventDefault();
      flipCard();
    } else if (e.key === "ArrowRight") {
      move(1);
    } else if (e.key === "ArrowLeft") {
      move(-1);
    }
  });

  // Reset progress handler
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      const msg = deckName
        ? "Reset progress for '" + deckName + "'?"
        : "Reset all progress?";
      const confirmed = window.confirm(msg);
      if (!confirmed) return;
      if (deckName) {
        Integros.resetStats(deckName);
      } else {
        Integros.resetStats();
      }
      index = 0;
      showingBack = false;
      updateScoreDisplay();
      renderCard();
      if (typeof showToast === "function") {
        showToast("Progress reset.", true);
      }
    });
  }

  // Initialize
  initDeckSelect();
  if (["normal", "mc"].indexOf(mode) === -1) {
    mode = "normal";
  }
  if (modeSelect) {
    modeSelect.value = mode;
  }
  setMode(mode);
  renderCard();
})();