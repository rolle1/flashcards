// AI Deck Generator
// Calls the Anthropic API with a topic prompt and generates flashcard JSON,
// previews the cards, then imports them into the Integros library on confirm.

(function () {
  function init() {
    if (!window.Integros) { setTimeout(init, 50); return; }
    setupGenerator();
  }

  function setupGenerator() {
    const topicInput    = document.getElementById("aiTopic");
    const countSelect   = document.getElementById("aiCount");
    const deckNameInput = document.getElementById("aiDeckName");
    const generateBtn   = document.getElementById("aiGenerateBtn");
    const btnLabel      = document.getElementById("aiGenerateBtnLabel");
    const statusEl      = document.getElementById("aiStatus");
    const previewEl     = document.getElementById("aiPreview");
    const previewCount  = document.getElementById("aiPreviewCount");
    const previewCards  = document.getElementById("aiPreviewCards");
    const importBtn     = document.getElementById("aiImportBtn");

    // Generated cards held in memory until imported
    let pendingCards = [];
    let pendingDeckName = "";

    // Auto-fill deck name from topic
    if (topicInput && deckNameInput) {
      topicInput.addEventListener("input", function () {
        const t = topicInput.value.trim();
        if (t && !deckNameInput.dataset.manuallyEdited) {
          deckNameInput.value = t;
        }
      });
      deckNameInput.addEventListener("input", function () {
        deckNameInput.dataset.manuallyEdited = "1";
      });
    }

    function setStatus(msg, type) {
      // type: "info" | "ok" | "error"
      statusEl.textContent = msg;
      statusEl.className = "ai-status ai-status--" + (type || "info");
    }

    function clearStatus() {
      statusEl.textContent = "";
      statusEl.className = "ai-status";
    }

    function setLoading(on) {
      generateBtn.disabled = on;
      btnLabel.textContent = on ? "Generating…" : "✦ Generate deck";
      generateBtn.classList.toggle("btn-ai--loading", on);
    }

    function renderPreview(cards) {
      previewCards.innerHTML = "";
      cards.forEach(function (card, i) {
        const row = document.createElement("div");
        row.className = "ai-preview-row";

        const num = document.createElement("span");
        num.className = "ai-preview-num";
        num.textContent = i + 1;

        const front = document.createElement("span");
        front.className = "ai-preview-front";
        front.textContent = card.front;

        const sep = document.createElement("span");
        sep.className = "ai-preview-sep";
        sep.textContent = "→";

        const back = document.createElement("span");
        back.className = "ai-preview-back";
        back.textContent = card.back;

        row.appendChild(num);
        row.appendChild(front);
        row.appendChild(sep);
        row.appendChild(back);
        previewCards.appendChild(row);
      });
    }

    if (generateBtn) {
      generateBtn.addEventListener("click", async function () {
        const topic = (topicInput.value || "").trim();
        const count = parseInt(countSelect.value, 10) || 20;
        const rawName = (deckNameInput.value || topic).trim();

        if (!topic) {
          setStatus("Enter a topic first.", "error");
          return;
        }
        if (!rawName) {
          setStatus("Enter a deck name.", "error");
          return;
        }

        clearStatus();
        previewEl.style.display = "none";
        setLoading(true);

        const systemPrompt = [
          "You are a flashcard generator. The user gives you a topic and a card count.",
          "You must respond with ONLY a valid JSON array — no markdown, no explanation, no code fences.",
          "Each element must be an object with exactly two string keys: \"front\" and \"back\".",
          "The front is a clear, specific question or prompt.",
          "The back is a concise, accurate answer — one to three sentences maximum.",
          "Cover a range of difficulty within the topic. Do not repeat concepts.",
          "Do not number the cards. Do not include any text outside the JSON array."
        ].join(" ");

        const userPrompt = "Topic: " + topic + "\nNumber of cards: " + count;

        try {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 8000,
              system: systemPrompt,
              messages: [{ role: "user", content: userPrompt }]
            })
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error && err.error.message ? err.error.message : "API error " + response.status);
          }

          const data = await response.json();
          const raw = (data.content || [])
            .filter(function (b) { return b.type === "text"; })
            .map(function (b) { return b.text; })
            .join("");

          // Strip any accidental markdown fences
          const clean = raw.replace(/^```[a-z]*\n?/i, "").replace(/```$/,"").trim();
          const cards = JSON.parse(clean);

          if (!Array.isArray(cards) || !cards.length) {
            throw new Error("No cards returned. Try a different topic.");
          }

          // Validate each card
          cards.forEach(function (c, i) {
            if (typeof c.front !== "string" || !c.front.trim() ||
                typeof c.back !== "string" || !c.back.trim()) {
              throw new Error("Card " + (i + 1) + " is missing front or back text.");
            }
          });

          pendingCards = cards;
          pendingDeckName = rawName;

          previewCount.textContent = cards.length + ' cards generated for "' + rawName + '"';
          renderPreview(cards);
          previewEl.style.display = "block";
          setStatus("Preview below — import when ready.", "ok");

        } catch (err) {
          console.error(err);
          setStatus(err.message || "Something went wrong. Try again.", "error");
        } finally {
          setLoading(false);
        }
      });
    }

    if (importBtn) {
      importBtn.addEventListener("click", function () {
        if (!pendingCards.length) return;

        const allDecks = Integros.getDecks();
        if (allDecks[pendingDeckName]) {
          const ok = window.confirm(
            'A deck named "' + pendingDeckName + '" already exists. Merge new cards into it?'
          );
          if (!ok) return;
        }

        const payload = {};
        payload[pendingDeckName] = pendingCards;
        Integros.mergeDecks(payload);

        showToast && showToast(
          'Imported "' + pendingDeckName + '" with ' + pendingCards.length + ' cards.', true
        );

        // Reset state
        pendingCards = [];
        pendingDeckName = "";
        previewEl.style.display = "none";
        clearStatus();
        topicInput.value = "";
        deckNameInput.value = "";
        delete deckNameInput.dataset.manuallyEdited;

        // Refresh the deck grid
        if (typeof renderDecks === "function") renderDecks();
        else window.location.reload();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();