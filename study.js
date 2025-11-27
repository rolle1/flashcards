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
  const rightBtn = document.getElementById("rightBtn");
  const wrongBtn = document.getElementById("wrongBtn");

  const mcRow = document.getElementById("mcRow");
  const mcButtons = Array.prototype.slice.call(
    document.querySelectorAll(".mc-option")
  );

  const typeRow = document.getElementById("typeRow");
  const typeInput = document.getElementById("typeInput");
  const typeCheckBtn = document.getElementById("typeCheckBtn");

  // Reset button for clearing progress
  const resetBtn = document.getElementById("resetBtn");

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

  // Load previously selected deck and mode from localStorage
  function loadFromLocalStorage(decks) {
    try {
      const lastDeck = window.localStorage.getItem("integros-lastDeck");
      const lastMode = window.localStorage.getItem("integros-lastMode");
      if (lastDeck && decks[lastDeck]) {
        deckName = lastDeck;
      }
      if (
        lastMode &&
        ["normal", "spaced", "mc", "type"].indexOf(lastMode) !== -1
      ) {
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
      loadFromLocalStorage(
