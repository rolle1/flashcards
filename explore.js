// Deck Explorer logic + Deck Library, New deck, delete, rename, and JSON tools
// This script drives the Explore page.  It displays all decks (both default
// and custom), allows users to create new decks, rename or delete existing
// decks, and import/export decks as JSON.  It relies on the Integros API
// defined in app.js for storage and deck operations.

(function () {
  const deckGridEl = document.getElementById("deck-grid");
  const newDeckBtn = document.getElementById("newDeckBtn");
  const jsonArea = document.getElementById("jsonArea");
  const importBtn = document.getElementById("importBtn");
  const exportBtn = document.getElementById("exportBtn");
  const statusEl = document.getElementById("jsonStatus");

  function clearStatus() {
    if (!statusEl) return;
    statusEl.textContent = "";
    statusEl.style.color = "#9ca3af";
  }

  function setStatus(msg, ok) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = ok ? "#4ade80" : "#fca5a5";
  }

  // Build a card element for the deck library.  Each card shows the deck
  // title, level, description, tags, and buttons to study, rename and delete.
  function createDeckCard(id, titleText, levelText, descText, tagsArr) {
    const card = document.createElement("article");
    card.className = "deck-card";

    const title = document.createElement("h3");
    title.textContent = titleText;

    const meta = document.createElement("p");
    meta.className = "deck-meta";
    meta.textContent = levelText;

    const desc = document.createElement("p");
    desc.className = "deck-desc";
    desc.textContent = descText;

    const tags = document.createElement("div");
    tags.className = "deck-tags";
    (tagsArr || []).forEach((t) => {
      const tag = document.createElement("span");
      tag.className = "deck-tag";
      tag.textContent = t;
      tags.appendChild(tag);
    });

    const actions = document.createElement("div");
    actions.className = "deck-actions";

    const studyLink = document.createElement("a");
    studyLink.href = "study.html?deck=" + encodeURIComponent(id);
    studyLink.className = "btn-pill";
    studyLink.textContent = "Study deck";

    // Edit button (open the edit page for this deck)
    const editLink = document.createElement("a");
    editLink.href = "edit.html?deck=" + encodeURIComponent(id);
    editLink.className = "btn-pill";
    editLink.textContent = "Edit";

    // Rename button
    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "btn-pill";
    renameBtn.textContent = "Rename";
    renameBtn.addEventListener("click", function () {
      const newName = window.prompt("Rename deck '" + id + "' to:", id);
      if (!newName) return;
      const trimmed = newName.trim();
      if (!trimmed) return;
      const result = Integros.renameDeck(id, trimmed);
      if (!result.ok) {
        showToast("Error: " + (result.reason || "Could not rename deck."), false);
        return;
      }
      showToast("Renamed deck '" + id + "' to '" + trimmed + "'.", true);
      setStatus("Renamed deck '" + id + "' to '" + trimmed + "'.", true);
      renderDecks();
    });

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-pill btn-bad";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      const confirmed = window.confirm("Delete deck '" + id + "'?");
      if (!confirmed) return;
      const result = Integros.deleteDeck(id);
      if (!result.ok) {
        showToast("Error: " + (result.reason || "Could not delete deck."), false);
        return;
      }
      showToast("Deleted deck '" + id + "'.", true);
      setStatus("Deleted deck '" + id + "'.", true);
      renderDecks();
    });

    actions.appendChild(studyLink);
    actions.appendChild(editLink);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(desc);
    card.appendChild(tags);
    card.appendChild(actions);

    return card;
  }

  // Render all decks.  Pull deck names from Integros.getDecks() and
  // metadata from Integros.getDeckMetadata().  Custom decks fall back
  // to a generic level and description.
  function renderDecks() {
    if (!deckGridEl) return;
    deckGridEl.innerHTML = "";
    if (!window.Integros || !Integros.getDecks) return;
    const allDecks = Integros.getDecks();
    const meta = Integros.getDeckMetadata ? Integros.getDeckMetadata() : {};
    Object.keys(allDecks).forEach(function (deckName) {
      const m = meta[deckName] || {};
      const title = m.title || deckName;
      const level = m.level || (m.title ? m.level : "Custom deck");
      const desc = m.description || (m.title ? m.description : "Your personal deck.");
      const tagsArr = m.tags || [];
      const card = createDeckCard(deckName, title, level, desc, tagsArr);
      deckGridEl.appendChild(card);
    });
  }

  // New deck creation with name validation
  if (newDeckBtn) {
    newDeckBtn.addEventListener("click", function () {
      clearStatus();
      if (!window.Integros || !Integros.mergeDecks) {
        window.alert("New deck is not available. Engine not loaded.");
        return;
      }
      const name = window.prompt("Enter a deck name:");
      if (!name) return;
      const trimmed = name.trim();
      if (!trimmed) {
        setStatus("Name cannot be empty.", false);
        return;
      }
      // Allow only letters, numbers, spaces and hyphens, 2–50 characters
      const invalid = /[^a-zA-Z0-9 \-]/;
      if (trimmed.length < 2 || trimmed.length > 50 || invalid.test(trimmed)) {
        setStatus(
          "Invalid deck name. Use 2–50 characters: letters, numbers, spaces or hyphens.",
          false
        );
        return;
      }
      const allDecks = Integros.getDecks();
      if (allDecks[trimmed]) {
        const overwrite = window.confirm(
          "A deck named '" +
            trimmed +
            "' already exists. Overwrite it with an empty deck?"
        );
        if (!overwrite) return;
      }
      const payload = {};
      payload[trimmed] = [];
      Integros.mergeDecks(payload);
      showToast("Created new deck '" + trimmed + "'.", true);
      setStatus("Created new empty deck '" + trimmed + "'.", true);
      renderDecks();
    });
  }

  // JSON Import with validation
  if (importBtn) {
    importBtn.addEventListener("click", function () {
      clearStatus();
      if (!jsonArea) {
        setStatus("JSON box not found.", false);
        return;
      }
      const text = jsonArea.value.trim();
      if (!text) {
        setStatus("Paste JSON first.", false);
        return;
      }
      try {
        const parsed = JSON.parse(text);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          setStatus(
            'Wrong format. Must look like: { "Deck Name": [ { "front": "", "back": "" } ] }',
            false
          );
          return;
        }
        Object.keys(parsed).forEach((deckName) => {
          const trimmedName = (deckName || "").trim();
          if (!trimmedName) {
            throw new Error("Deck name cannot be empty.");
          }
          const invalidName = /[^a-zA-Z0-9 \-]/;
          if (
            trimmedName.length < 2 ||
            trimmedName.length > 50 ||
            invalidName.test(trimmedName)
          ) {
            throw new Error(
              "Invalid deck name '" +
                deckName +
                "'. Names must be 2–50 characters (letters, numbers, spaces or hyphens)."
            );
          }
          const arr = parsed[deckName];
          if (!Array.isArray(arr)) {
            throw new Error("Deck " + deckName + " is not an array.");
          }
          arr.forEach((card, idx) => {
            if (
              !card ||
              typeof card.front !== "string" ||
              typeof card.back !== "string" ||
              !card.front.trim() ||
              !card.back.trim()
            ) {
              throw new Error(
                "Deck " +
                  deckName +
                  " card " +
                  idx +
                  " must have non-empty 'front' and 'back' strings."
              );
            }
          });
        });
        Integros.mergeDecks(parsed);
        showToast("Imported decks successfully.", true);
        setStatus("Imported JSON decks successfully.", true);
        renderDecks();
      } catch (err) {
        console.error(err);
        showToast(err.message || "Invalid JSON.", false);
        setStatus(err.message || "Invalid JSON. Fix formatting and try again.", false);
      }
    });
  }

  // JSON Export
  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      clearStatus();
      if (!jsonArea) {
        setStatus("JSON area missing.", false);
        return;
      }
      jsonArea.value = JSON.stringify(Integros.getDecks(), null, 2);
      showToast("Exported current decks.", true);
      setStatus("Exported current decks.", true);
    });
  }

  // Initialize the deck library
  renderDecks();
})();