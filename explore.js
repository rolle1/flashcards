// Deck Explorer logic + Deck Library, New deck, delete, and JSON tools
(function () {
  // Curated decks for the top "Deck Library" cards.
  const STATIC_DECKS = [
    {
      id: "AZ-900 Fundamentals",
      title: "AZ-900 Fundamentals",
      level: "Beginner",
      description:
        "Core Azure concepts, global infrastructure, pricing, and security basics.",
      tags: ["Azure", "Cloud", "Exam"]
    },
    {
      id: "Infra Core Concepts",
      title: "Infra Core Concepts",
      level: "Intermediate",
      description:
        "Servers, storage, networks, backups. The foundation of infra operations.",
      tags: ["Infra", "Ops"]
    },
    {
      id: "ITAM & CMDB",
      title: "ITAM & CMDB",
      level: "Intermediate",
      description:
        "Assets, lifecycle states, relationships, clean configuration data.",
      tags: ["ITAM", "CMDB"]
    }
  ];

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

  // Build a card element
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
    (tagsArr || []).forEach(t => {
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

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-pill btn-bad";
    deleteBtn.textContent = "Delete";

    deleteBtn.addEventListener("click", function () {
      const confirmed = window.confirm("Delete deck '" + id + "'?");
      if (!confirmed) return;

      const result = Integros.deleteDeck(id);

      if (!result.ok) {
        window.alert(
          "Could not delete deck: " + (result.reason || "Unknown error")
        );
        return;
      }

      setStatus("Deleted deck '" + id + "'.", true);
      renderDecks();
    });

    actions.appendChild(studyLink);
    actions.appendChild(deleteBtn);

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(desc);
    card.appendChild(tags);
    card.appendChild(actions);

    return card;
  }

  // Render all decks (static + custom)
  function renderDecks() {
    if (!deckGridEl) return;

    deckGridEl.innerHTML = "";

    const allDecks = Integros.getDecks();
    const staticIds = STATIC_DECKS.map(d => d.id);

    // Render static curated decks first
    STATIC_DECKS.forEach(deck => {
      const card = createDeckCard(
        deck.id,
        deck.title,
        deck.level,
        deck.description,
        deck.tags
      );
      deckGridEl.appendChild(card);
    });

    // Render custom decks
    Object.keys(allDecks).forEach(deckName => {
      if (!staticIds.includes(deckName)) {
        const card = createDeckCard(
          deckName,
          deckName,
          "Custom deck",
          "Your personal deck.",
          []
        );
        deckGridEl.appendChild(card);
      }
    });
  }

  // New deck creation
  if (newDeckBtn) {
    newDeckBtn.addEventListener("click", function () {
      if (!window.Integros || !Integros.mergeDecks) {
        window.alert("New deck is not available. Engine not loaded.");
        return;
      }

      const name = window.prompt("Enter a deck name:");
      if (!name) return;

      const trimmed = name.trim();
      if (!trimmed) return;

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
      setStatus("Created new empty deck '" + trimmed + "'.", true);

      renderDecks();
    });
  }

  // JSON Import
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

        Object.keys(parsed).forEach(deckName => {
          const arr = parsed[deckName];
          if (!Array.isArray(arr)) {
            throw new Error("Deck " + deckName + " is not an array.");
          }

          arr.forEach((card, idx) => {
            if (
              !card ||
              typeof card.front !== "string" ||
              typeof card.back !== "string"
            ) {
              throw new Error(
                "Deck " +
                  deckName +
                  " card " +
                  idx +
                  " missing front/back string."
              );
            }
          });
        });

        Integros.mergeDecks(parsed);
        setStatus("Imported JSON decks successfully.", true);

        renderDecks();
      } catch (err) {
        console.error(err);
        setStatus("Invalid JSON. Fix formatting and try again.", false);
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
      setStatus("Exported current decks.", true);
    });
  }

  // Start
  renderDecks();
})();