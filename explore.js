(function () {
  const deckListEl = document.getElementById("deckList");
  const jsonArea = document.getElementById("jsonArea");
  const importBtn = document.getElementById("importBtn");
  const exportBtn = document.getElementById("exportBtn");
  const statusEl = document.getElementById("jsonStatus");

  function clearStatus() {
    statusEl.textContent = "";
    statusEl.style.color = "#9ca3af";
  }

  function setStatus(msg, ok) {
    statusEl.textContent = msg;
    statusEl.style.color = ok ? "#4ade80" : "#fca5a5";
  }

  function renderDecks() {
    const decks = Integros.getDecks();
    const names = Object.keys(decks);
    deckListEl.innerHTML = "";

    if (!names.length) {
      const div = document.createElement("div");
      div.className = "deck-item";
      div.textContent =
        "No decks loaded. Import JSON below or go back to defaults by clearing local storage.";
      deckListEl.appendChild(div);
      return;
    }

    names.forEach(function (name) {
      const cards = decks[name] || [];
      const item = document.createElement("div");
      item.className = "deck-item";

      const meta = document.createElement("div");
      meta.className = "deck-meta";
      const title = document.createElement("strong");
      title.textContent = name;
      const sub = document.createElement("span");
      sub.textContent = cards.length + " cards";
      meta.appendChild(title);
      meta.appendChild(sub);

      const actions = document.createElement("div");
      actions.className = "deck-actions";

      const studyLink = document.createElement("a");
      studyLink.href = "study.html?deck=" + encodeURIComponent(name);
      studyLink.className = "btn-pill";
      studyLink.textContent = "Study";

      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "btn-pill";
      renameBtn.textContent = "Rename";
      renameBtn.addEventListener("click", function () {
        const newName = prompt("New name for deck '" + name + "':", name);
        if (!newName) return;
        const result = Integros.renameDeck(name, newName);
        if (!result.ok) {
          setStatus(result.reason || "Could not rename deck.", false);
          return;
        }
        setStatus("Renamed deck to " + newName + ".", true);
        renderDecks();
      });

      actions.appendChild(studyLink);
      actions.appendChild(renameBtn);
      item.appendChild(meta);
      item.appendChild(actions);
      deckListEl.appendChild(item);
    });


  importBtn.addEventListener("click", function () {
    clearStatus();
    const text = jsonArea.value.trim();
    if (!text) {
      setStatus("Paste JSON into the box first.", false);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        setStatus("Root JSON must be an object: { \"Deck name\": [ ... ] }", false);
        return;
      }
      Object.keys(parsed).forEach(function (deckName) {
        const arr = parsed[deckName];
        if (!Array.isArray(arr)) {
          throw new Error("Deck " + deckName + " is not an array.");
        }
        arr.forEach(function (card, idx) {
          if (!card || typeof card.front !== "string" || typeof card.back !== "string") {
            throw new Error("Deck " + deckName + " card " + idx + " missing front/back string.");
          }
        });
      });
      Integros.replaceDecks(parsed);
      renderDecks();
      setStatus("Imported decks from JSON.", true);
    } catch (err) {
      setStatus("Invalid JSON or structure. Check commas and fields.", false);
    }
  });

  exportBtn.addEventListener("click", function () {
    clearStatus();
    const decks = Integros.getDecks();
    jsonArea.value = JSON.stringify(decks, null, 2);
    setStatus("Exported current decks to JSON.", true);
  });

  renderDecks();
})();
