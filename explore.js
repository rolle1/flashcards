// Deck Explorer logic + static Deck Library
(function () {
  // Static deck registry for the Deck Library grid
  const STATIC_DECKS = [
    {
      id: "az900-fundamentals",
      title: "AZ-900 Fundamentals",
      level: "Beginner",
      description:
        "Core Azure concepts, global infrastructure, pricing, and security basics.",
      tags: ["Azure", "Cloud", "Exam"]
    },
    {
      id: "infra-core",
      title: "Infra Core Concepts",
      level: "Intermediate",
      description:
        "Servers, storage, networks, backups. The foundation of infra operations.",
      tags: ["Infra", "Ops"]
    },
    {
      id: "itam-cmdb",
      title: "ITAM & CMDB",
      level: "Intermediate",
      description:
        "Assets, lifecycle states, relationships, clean configuration data.",
      tags: ["ITAM", "CMDB"]
    }
    // Add more curated decks here as you build them
  ];

  const deckGridEl = document.getElementById("deck-grid");

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

  // Render the static Deck Library cards
  function renderStaticDecks() {
    if (!deckGridEl) return;

    deckGridEl.innerHTML = "";

    if (!STATIC_DECKS.length) {
      const empty = document.createElement("p");
      empty.className = "deck-empty";
      empty.textContent =
        "No curated decks yet. Add them in explore.js under STATIC_DECKS.";
      deckGridEl.appendChild(empty);
      return;
    }

    STATIC_DECKS.forEach(function (deck) {
      const card = document.createElement("article");
      card.className = "deck-card";

      const title = document.createElement("h3");
      title.textContent = deck.title;

      const meta = document.createElement("p");
      meta.className = "deck-meta";
      meta.textContent = deck.level;

      const desc = document.createElement("p");
      desc.className = "deck-desc";
      desc.textContent = deck.description;

      const tags = document.createElement("div");
      tags.className = "deck-tags";
      (deck.tags || []).forEach(function (tagText) {
        const tag = document.createElement("span");
        tag.className = "deck-tag";
        tag.textContent = tagText;
        tags.appendChild(tag);
      });

      const actions = document.createElement("div");
      actions.className = "deck-actions";

      const studyLink = document.createElement("a");
      studyLink.href = "study.html?deck=" + encodeURIComponent(deck.id);
      studyLink.className = "btn primary";
      studyLink.textContent = "Study deck";

      actions.appendChild(studyLink);

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(desc);
      card.appendChild(tags);
      card.appendChild(actions);

      deckGridEl.appendChild(card);
    });
  }

  // JSON import / export section
  if (importBtn) {
    importBtn.addEventListener("click", function () {
      clearStatus();
      if (!jsonArea) {
        setStatus("JSON editor not found on page.", false);
        return;
      }

      const text = jsonArea.value.trim();
      if (!text) {
        setStatus("Paste JSON into the box first.", false);
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
            'Root JSON must be an object: { "Deck name": [ { "front": "...", "back": "..." } ] }',
            false
          );
          return;
        }

        Object.keys(parsed).forEach(function (deckName) {
          const arr = parsed[deckName];
          if (!Array.isArray(arr)) {
            throw new Error("Deck " + deckName + " is not an array.");
          }
          arr.forEach(function (card, idx) {
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

        // Replace decks in your Integros engine
        Integros.replaceDecks(parsed);
        setStatus("Imported decks from JSON.", true);
      } catch (err) {
        console.error(err);
        setStatus("Invalid JSON or structure. Check commas and fields.", false);
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      clearStatus();
      if (!jsonArea) {
        setStatus("JSON editor not found on page.", false);
        return;
      }
      const decks = Integros.getDecks();
      jsonArea.value = JSON.stringify(decks, null, 2);
      setStatus("Exported current decks to JSON.", true);
    });
  }

  // Kick things off
  renderStaticDecks();
})();
