(function () {
  const deckSelect = document.getElementById("deckSelect");
  const modeSelect = document.getElementById("modeSelect");
  const cardEl = document.getElementById("card");
  const cardText = document.getElementById("cardText");
  const cardLabel = document.getElementById("cardLabel");
  const cardIndexEl = document.getElementById("cardIndex");
  const cardTotalEl = document.getElementById("cardTotal");
  const cardDeckNameEl = document.getElementById("cardDeckName");
  const scoreText = document.getElementById("scoreText");

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const flipBtn = document.getElementById("flipBtn");
  const rightBtn = document.getElementById("rightBtn");
  const wrongBtn = document.getElementById("wrongBtn");

  const mcRow = document.getElementById("mcRow");
  const mcButtons = Array.prototype.slice.call(
    document.querySelectorAll(".mc-option")
  );

  const typeRow = document.getElementById("typeRow");
  const typeInput = document.getElementById("typeInput");
  const typeCheckBtn = document.getElementById("typeCheckBtn");

  let deckName = "";
  let deck = [];
  let index = 0;
  let showingBack = false;
  let mode = "normal";
  let mcCorrectOptionIndex = null;

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
    if (dx > 60) {
      if (mode === "spaced") {
        moveSpaced();
      } else {
        move(-1);
      }
      return;
    }

    // Swipe left: next
    if (dx < -60) {
      if (mode === "spaced") {
        moveSpaced();
      } else {
        move(1);
      }
      return;
    }

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
      deckName = keys[0] || "";
    }

    deckSelect.value = deckName;
    deck = decks[deckName] || [];

    const last = Integros.getLastIndex(deckName, deck.length);
    index = last;
    updateScoreDisplay();
  }

  function updateScoreDisplay() {
    const stats = Integros.getStatsSnapshot(deckName, deck.length);
    scoreText.textContent = stats.correct + " right / " + stats.total + " total";
  }

  function renderCard() {
    cardDeckNameEl.textContent = deckName;

    if (!deck.length) {
      cardText.textContent = "No cards in this deck.\nGo to Explore and load some.";
      cardLabel.textContent = "Empty";
      cardIndexEl.textContent = "0";
      cardTotalEl.textContent = "0";
      return;
    }

    const current = deck[index];
    cardText.textContent = showingBack ? current.back : current.front;
    cardLabel.textContent = showingBack ? "Answer" : "Question";
    cardIndexEl.textContent = String(index + 1);
    cardTotalEl.textContent = String(deck.length);
    updateScoreDisplay();
    refreshModeUI();
  }

  function setMode(newMode) {
    mode = newMode;

    if (mode === "mc") {
      mcRow.style.display = "flex";
      typeRow.style.display = "none";
      prepareMultipleChoiceOptions();
    } else if (mode === "type") {
      mcRow.style.display = "none";
      typeRow.style.display = "flex";
      typeInput.value = "";
    } else {
      mcRow.style.display = "none";
      typeRow.style.display = "none";
    }
  }

  function refreshModeUI() {
    if (mode === "mc") {
      prepareMultipleChoiceOptions();
    } else if (mode === "type") {
      typeInput.value = "";
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

  function moveSpaced() {
    if (!deck.length) return;
    const len = deck.length;
    index = Integros.chooseSpacedIndex(deckName, len);
    showingBack = false;
    renderCard();
  }

  function record(correct) {
    if (!deck.length) return;
    const spacedMode = mode === "spaced";
    Integros.recordAnswer(
      deckName,
      deck.length,
      index,
      correct,
      spacedMode
    );
    updateScoreDisplay();

    if (spacedMode) {
      moveSpaced();
    } else {
      move(1);
    }
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

  function normalize(str) {
    return String(str || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function handleTypeCheck() {
    if (!deck.length) return;
    const expected = deck[index].back;
    const given = typeInput.value;
    if (!given.trim()) return;

    const ok = normalize(expected) === normalize(given);
    record(ok);
  }

  // Click listeners
  cardEl.addEventListener("click", flipCard);
  flipBtn.addEventListener("click", flipCard);

  prevBtn.addEventListener("click", function () {
    if (mode === "spaced") {
      moveSpaced();
    } else {
      move(-1);
    }
  });

  nextBtn.addEventListener("click", function () {
    if (mode === "spaced") {
      moveSpaced();
    } else {
      move(1);
    }
  });

  rightBtn.addEventListener("click", function () {
    record(true);
  });

  wrongBtn.addEventListener("click", function () {
    record(false);
  });

  deckSelect.addEventListener("change", function (e) {
    const decks = Integros.getDecks();
    deckName = e.target.value;
    deck = decks[deckName] || [];
    index = Integros.getLastIndex(deckName, deck.length);
    showingBack = false;
    renderCard();
  });

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

  typeCheckBtn.addEventListener("click", handleTypeCheck);

  typeInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTypeCheck();
    }
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (e.code === "Space") {
      e.preventDefault();
      flipCard();
    } else if (e.key === "ArrowRight") {
      if (mode === "spaced") moveSpaced();
      else move(1);
    } else if (e.key === "ArrowLeft") {
      if (mode === "spaced") moveSpaced();
      else move(-1);
    } else if (e.key === "1") {
      record(true);
    } else if (e.key === "2") {
      record(false);
    }
  });

  // Init
  initDeckSelect();
  setMode(modeSelect.value);
  renderCard();
})();