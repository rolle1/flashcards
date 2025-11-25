// Deck editing page logic.  Allows editing the contents of a single deck.
//
// This script loads the specified deck (via ?deck= query param),
// displays each card as a row with front/back inputs and a delete button,
// and allows adding new rows.  When the user saves, it collects all
// non-empty rows and updates the deck via Integros.mergeDecks().  A
// toast notification confirms success.

(function () {
  // Parse deck name from query parameter
  const params = new URLSearchParams(window.location.search);
  const deckName = params.get("deck");
  if (!deckName) {
    // No deck specified – go back to explore page
    window.location.href = "explore.html";
    return;
  }

  // Elements
  const deckTitleEl = document.getElementById("deckTitle");
  const editorHeading = document.getElementById("editorHeading");
  const editor = document.getElementById("cardEditor");
  const addCardBtn = document.getElementById("addCardBtn");
  const saveDeckBtn = document.getElementById("saveDeckBtn");
  const cancelEditLink = document.getElementById("cancelEditLink");

  // Update deck title display
  deckTitleEl.textContent = deckName;
  editorHeading.textContent = "Editing deck: " + deckName;
  cancelEditLink.href = "explore.html";

  // Retrieve deck cards from Integros
  const decks = Integros.getDecks();
  const cards = Array.isArray(decks[deckName]) ? decks[deckName] : [];

  // Helper to create a row for a single card
  function createRow(frontVal, backVal) {
    const row = document.createElement("div");
    row.className = "card-edit-row";
    const frontInput = document.createElement("input");
    frontInput.type = "text";
    frontInput.placeholder = "Front";
    frontInput.value = frontVal || "";
    frontInput.className = "card-edit-front";
    const backInput = document.createElement("input");
    backInput.type = "text";
    backInput.placeholder = "Back";
    backInput.value = backVal || "";
    backInput.className = "card-edit-back";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-pill btn-bad";
    delBtn.textContent = "Delete";
    delBtn.setAttribute("aria-label", "Delete this card");
    delBtn.addEventListener("click", function () {
      editor.removeChild(row);
    });
    row.appendChild(frontInput);
    row.appendChild(backInput);
    row.appendChild(delBtn);
    return row;
  }

  // Render existing cards
  function renderRows() {
    editor.innerHTML = "";
    cards.forEach(function (card) {
      const row = createRow(card.front, card.back);
      editor.appendChild(row);
    });
  }

  // Add new empty row on button click
  if (addCardBtn) {
    addCardBtn.addEventListener("click", function () {
      const newRow = createRow("", "");
      editor.appendChild(newRow);
    });
  }

  // Save changes to the deck
  if (saveDeckBtn) {
    saveDeckBtn.addEventListener("click", function () {
      const rows = editor.querySelectorAll(".card-edit-row");
      const newCards = [];
      rows.forEach(function (row) {
        const f = row.querySelector(".card-edit-front").value;
        const b = row.querySelector(".card-edit-back").value;
        const front = (f || "").trim();
        const back = (b || "").trim();
        if (front && back) {
          newCards.push({ front: front, back: back });
        }
      });
      const payload = {};
      payload[deckName] = newCards;
      Integros.mergeDecks(payload);
      if (typeof showToast === "function") {
        showToast("Saved deck '" + deckName + "' with " + newCards.length + " cards.", true);
      }
      // Optionally navigate back to explore page after save
      // window.location.href = "explore.html";
    });
  }

  // Initial render
  renderRows();
})();