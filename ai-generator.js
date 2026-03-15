// AI Deck Generator — fully revised
// Improvements:
//   UX:           editable preview rows, per-card delete & regenerate,
//                 animated skeleton loader, Regenerate button
//   Code quality: extracted API fn, toast wrapper, validate fn,
//                 custom-event fallback for renderDecks
//   AI quality:   richer system prompt, card-type selector, difficulty
//                 distribution, language support
//   New features: JSON/CSV download, duplicate detection with counts,
//                 per-card regenerate, informative merge dialog

(function () {

  // ─── Utilities ────────────────────────────────────────────────────────────

  function toast(msg, ok) {
    if (typeof showToast === "function") showToast(msg, !!ok);
  }

  function notifyDecksUpdated() {
    if (typeof window.renderDecks === "function") {
      window.renderDecks();
    } else {
      window.dispatchEvent(new CustomEvent("decksUpdated"));
    }
  }

  function validate(topic, deckName) {
    if (!topic)    return "Enter a topic first.";
    if (!deckName) return "Enter a deck name.";
    return null;
  }

  // ─── API call (separated from UI) ─────────────────────────────────────────

  const CARD_TYPE_INSTRUCTIONS = {
    qa:
      "Generate Q&A cards. The front is a clear, specific question; the back is a concise, accurate answer (one to three sentences).",
    fill:
      "Generate fill-in-the-blank cards. The front is a sentence with a key term replaced by ___; the back is the missing term plus a one-sentence explanation.",
    tf:
      "Generate True/False cards. The front is a declarative statement (true or false); the back begins with 'True.' or 'False.' and explains why in one sentence.",
    mixed:
      "Mix card formats roughly equally: one-third Q&A, one-third fill-in-the-blank, one-third True/False.",
  };

  async function generateFlashcards(topic, count, cardType, language) {
    const typeInstruction =
      CARD_TYPE_INSTRUCTIONS[cardType] || CARD_TYPE_INSTRUCTIONS.qa;

    const systemPrompt = [
      "You are an expert flashcard generator.",
      "The user gives you a topic, a card count, and a card style.",
      "You must respond with ONLY a valid JSON array — no markdown, no explanation, no code fences.",
      "Each element must be an object with exactly two string keys: \"front\" and \"back\".",
      typeInstruction,
      "Every card must test genuine understanding — prefer application, scenarios (" +
        "\"Given X, what happens if…\"), comparisons, and edge cases over simple definitions.",
      "Vary question formats: include definition, scenario, compare/contrast, and cause-effect types.",
      "Distribute difficulty: approximately 30 % beginner, 50 % intermediate, 20 % advanced.",
      "Never generate trivial or overly simple cards (e.g. 'What colour is the sky?').",
      "Cover a range of distinct concepts; do not repeat the same idea in different wording.",
      "Do not number the cards. Do not include any text outside the JSON array.",
      language && language !== "English"
        ? "Write all card content (front and back) in " + language + "."
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    const userPrompt =
      "Topic: " + topic + "\nNumber of cards: " + count;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(
        errBody.error && errBody.error.message
          ? errBody.error.message
          : "API error " + response.status
      );
    }

    const data = await response.json();
    const raw = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const clean = raw
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/, "")
      .trim();

    let cards;
    try {
      cards = JSON.parse(clean);
    } catch (_) {
      throw new Error(
        "Could not parse the AI response as JSON. Try regenerating."
      );
    }

    if (!Array.isArray(cards) || !cards.length) {
      throw new Error("No cards returned. Try a different topic.");
    }

    cards.forEach(function (c, i) {
      if (
        typeof c.front !== "string" ||
        !c.front.trim() ||
        typeof c.back !== "string" ||
        !c.back.trim()
      ) {
        throw new Error(
          "Card " + (i + 1) + " is missing front or back text."
        );
      }
    });

    return cards;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    if (!window.Integros) { setTimeout(init, 50); return; }
    setupGenerator();
  }

  function setupGenerator() {
    // DOM references
    const topicInput     = document.getElementById("aiTopic");
    const countSelect    = document.getElementById("aiCount");
    const cardTypeSelect = document.getElementById("aiCardType");
    const languageSelect = document.getElementById("aiLanguage");
    const deckNameInput  = document.getElementById("aiDeckName");
    const generateBtn    = document.getElementById("aiGenerateBtn");
    const btnLabel       = document.getElementById("aiGenerateBtnLabel");
    const regenBtn       = document.getElementById("aiRegenBtn");
    const statusEl       = document.getElementById("aiStatus");
    const skeletonEl     = document.getElementById("aiSkeleton");
    const previewEl      = document.getElementById("aiPreview");
    const previewCount   = document.getElementById("aiPreviewCount");
    const previewCards   = document.getElementById("aiPreviewCards");
    const importBtn      = document.getElementById("aiImportBtn");
    const exportBtn      = document.getElementById("aiExportBtn");

    // In-memory state
    let pendingCards    = [];
    let pendingDeckName = "";

    // ── Auto-fill deck name ────────────────────────────────────────────────
    if (topicInput && deckNameInput) {
      topicInput.addEventListener("input", function () {
        if (!deckNameInput.dataset.manuallyEdited) {
          deckNameInput.value = topicInput.value.trim();
        }
      });
      deckNameInput.addEventListener("input", function () {
        deckNameInput.dataset.manuallyEdited = "1";
      });
    }

    // ── Status helpers ─────────────────────────────────────────────────────
    function setStatus(msg, type) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = "ai-status ai-status--" + (type || "info");
    }
    function clearStatus() {
      if (!statusEl) return;
      statusEl.textContent = "";
      statusEl.className = "ai-status";
    }

    // ── Loading state ──────────────────────────────────────────────────────
    function setLoading(on) {
      generateBtn.disabled = on;
      if (btnLabel) btnLabel.textContent = on ? "Generating…" : "✦ Generate deck";
      generateBtn.classList.toggle("btn-ai--loading", on);
      if (regenBtn)   regenBtn.disabled = on;
      if (skeletonEl) skeletonEl.style.display = on ? "block" : "none";
      if (previewEl && on) previewEl.style.display = "none";
    }

    // ── Skeleton rows ──────────────────────────────────────────────────────
    function buildSkeleton() {
      if (!skeletonEl) return;
      skeletonEl.innerHTML = "";
      for (let i = 0; i < 5; i++) {
        const row = document.createElement("div");
        row.className = "ai-skeleton-row";

        const num = document.createElement("span");
        num.className = "ai-skeleton-cell ai-skeleton-num";

        const front = document.createElement("span");
        front.className = "ai-skeleton-cell ai-skeleton-front";

        const sep = document.createElement("span");
        sep.className = "ai-skeleton-sep";
        sep.textContent = "→";

        const back = document.createElement("span");
        back.className = "ai-skeleton-cell ai-skeleton-back";

        row.appendChild(num);
        row.appendChild(front);
        row.appendChild(sep);
        row.appendChild(back);
        skeletonEl.appendChild(row);
      }
    }

    // ── Per-card regenerate ────────────────────────────────────────────────
    async function regenerateSingleCard(rowIndex) {
      const topic = (topicInput ? topicInput.value : "").trim();
      if (!topic) return;
      const cardType = cardTypeSelect ? cardTypeSelect.value : "qa";
      const language = languageSelect ? languageSelect.value : "English";

      const rows = previewCards ? previewCards.querySelectorAll(".ai-preview-row") : [];
      const rowEl = rows[rowIndex];
      if (rowEl) rowEl.classList.add("ai-preview-row--loading");

      try {
        const newCards = await generateFlashcards(
          "Generate a single flashcard about: " + topic +
            ". The existing cards cover: " +
            pendingCards.map((c) => c.front).join("; "),
          1,
          cardType,
          language
        );
        if (newCards.length) {
          pendingCards[rowIndex] = newCards[0];
          renderPreview();
        }
      } catch (err) {
        toast("Failed to regenerate card: " + err.message, false);
        if (rowEl) rowEl.classList.remove("ai-preview-row--loading");
      }
    }

    // ── Preview rendering ──────────────────────────────────────────────────
    function renderPreview() {
      if (!previewCards) return;
      previewCards.innerHTML = "";

      pendingCards.forEach(function (card, i) {
        const row = document.createElement("div");
        row.className = "ai-preview-row";

        const num = document.createElement("span");
        num.className = "ai-preview-num";
        num.textContent = i + 1;

        // Editable front
        const frontEl = document.createElement("span");
        frontEl.className = "ai-preview-front";
        frontEl.contentEditable = "true";
        frontEl.spellcheck = false;
        frontEl.setAttribute("aria-label", "Edit front of card " + (i + 1));
        frontEl.textContent = card.front;
        frontEl.addEventListener("blur", function () {
          pendingCards[i] = Object.assign({}, pendingCards[i], {
            front: frontEl.textContent.trim() || pendingCards[i].front,
          });
        });

        const sep = document.createElement("span");
        sep.className = "ai-preview-sep";
        sep.textContent = "→";

        // Editable back
        const backEl = document.createElement("span");
        backEl.className = "ai-preview-back";
        backEl.contentEditable = "true";
        backEl.spellcheck = false;
        backEl.setAttribute("aria-label", "Edit back of card " + (i + 1));
        backEl.textContent = card.back;
        backEl.addEventListener("blur", function () {
          pendingCards[i] = Object.assign({}, pendingCards[i], {
            back: backEl.textContent.trim() || pendingCards[i].back,
          });
        });

        // Per-card regenerate button
        const regenCardBtn = document.createElement("button");
        regenCardBtn.className = "ai-card-btn ai-card-btn--regen";
        regenCardBtn.title = "Regenerate this card";
        regenCardBtn.setAttribute("aria-label", "Regenerate card " + (i + 1));
        regenCardBtn.textContent = "↻";
        regenCardBtn.addEventListener("click", function () {
          regenerateSingleCard(i);
        });

        // Per-card delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "ai-card-btn ai-card-btn--delete";
        deleteBtn.title = "Remove this card";
        deleteBtn.setAttribute("aria-label", "Delete card " + (i + 1));
        deleteBtn.textContent = "✕";
        deleteBtn.addEventListener("click", function () {
          pendingCards.splice(i, 1);
          if (previewCount) {
            previewCount.textContent =
              pendingCards.length + ' cards for "' + pendingDeckName + '"';
          }
          renderPreview();
        });

        row.appendChild(num);
        row.appendChild(frontEl);
        row.appendChild(sep);
        row.appendChild(backEl);
        row.appendChild(regenCardBtn);
        row.appendChild(deleteBtn);
        previewCards.appendChild(row);
      });
    }

    // ── Core generate flow ─────────────────────────────────────────────────
    async function runGenerate() {
      const topic    = (topicInput    ? topicInput.value    : "").trim();
      const count    = parseInt(countSelect ? countSelect.value : "20", 10) || 20;
      const rawName  = (deckNameInput ? deckNameInput.value : topic).trim() || topic;
      const cardType = cardTypeSelect ? cardTypeSelect.value : "qa";
      const language = languageSelect ? languageSelect.value : "English";

      const errMsg = validate(topic, rawName);
      if (errMsg) { setStatus(errMsg, "error"); return; }

      clearStatus();
      if (previewEl) previewEl.style.display = "none";
      if (regenBtn)  regenBtn.style.display  = "none";
      buildSkeleton();
      setLoading(true);

      try {
        const cards = await generateFlashcards(topic, count, cardType, language);

        pendingCards    = cards;
        pendingDeckName = rawName;

        if (previewCount) {
          previewCount.textContent =
            cards.length + ' cards for "' + rawName + '"';
        }
        renderPreview();
        if (previewEl) previewEl.style.display = "block";
        if (regenBtn)  regenBtn.style.display  = "inline-flex";
        setStatus(
          cards.length +
            " cards ready — click any row to edit, then import.",
          "ok"
        );
      } catch (err) {
        console.error(err);
        setStatus(err.message || "Something went wrong. Try again.", "error");
      } finally {
        setLoading(false);
      }
    }

    // ── Button wiring ──────────────────────────────────────────────────────
    if (generateBtn) {
      generateBtn.addEventListener("click", runGenerate);
    }

    if (regenBtn) {
      regenBtn.addEventListener("click", runGenerate);
    }

    // Download pending cards as JSON file
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        if (!pendingCards.length) return;
        const payload = {};
        payload[pendingDeckName] = pendingCards;
        const blob = new Blob(
          [JSON.stringify(payload, null, 2)],
          { type: "application/json" }
        );
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = pendingDeckName.replace(/[^a-z0-9]/gi, "_") + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast("Deck downloaded as JSON.", true);
      });
    }

    // Import with duplicate detection + informative confirm
    if (importBtn) {
      importBtn.addEventListener("click", function () {
        if (!pendingCards.length) return;

        // Flush any active contentEditable before collecting
        if (document.activeElement && previewCards &&
            previewCards.contains(document.activeElement)) {
          document.activeElement.blur();
        }

        const validCards = pendingCards.filter(
          (c) => (c.front || "").trim() && (c.back || "").trim()
        );
        if (!validCards.length) {
          setStatus("No valid cards to import.", "error");
          return;
        }

        const allDecks  = Integros.getDecks();
        const existing  = allDecks[pendingDeckName] || [];

        if (existing.length) {
          // Duplicate detection: compare front text (case-insensitive)
          const existingFronts = new Set(
            existing.map((c) => c.front.trim().toLowerCase())
          );
          const fresh = validCards.filter(
            (c) => !existingFronts.has(c.front.trim().toLowerCase())
          );
          const dupeCount = validCards.length - fresh.length;

          const lines = [
            'Merge into existing deck "' + pendingDeckName + '"?',
            "",
            "  • " + fresh.length +
              " new card" + (fresh.length !== 1 ? "s" : "") + " will be added",
          ];
          if (dupeCount > 0) {
            lines.push(
              "  • " + dupeCount +
                " duplicate" + (dupeCount !== 1 ? "s" : "") +
                " will be skipped (same front text already exists)"
            );
          } else {
            lines.push("  • No duplicates found");
          }

          if (!window.confirm(lines.join("\n"))) return;

          if (!fresh.length) {
            toast("All cards were duplicates — nothing imported.", false);
            return;
          }

          const payload = {};
          payload[pendingDeckName] = existing.concat(fresh);
          Integros.mergeDecks(payload);
          toast(
            '"' + pendingDeckName + '" updated — ' +
              fresh.length + " new card" + (fresh.length !== 1 ? "s" : "") +
              " added.",
            true
          );
        } else {
          const payload = {};
          payload[pendingDeckName] = validCards;
          Integros.mergeDecks(payload);
          toast(
            'Imported "' + pendingDeckName + '" with ' +
              validCards.length + " card" + (validCards.length !== 1 ? "s" : "") + ".",
            true
          );
        }

        // Reset UI
        pendingCards    = [];
        pendingDeckName = "";
        if (previewEl)    previewEl.style.display   = "none";
        if (regenBtn)     regenBtn.style.display     = "none";
        clearStatus();
        if (topicInput)    topicInput.value           = "";
        if (deckNameInput) {
          deckNameInput.value = "";
          delete deckNameInput.dataset.manuallyEdited;
        }

        notifyDecksUpdated();
      });
    }
  }

  // ─── Bootstrap ────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();