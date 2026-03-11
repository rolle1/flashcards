// Google Drive Sync for Integros Flashcards
// Uses Google Identity Services (popup OAuth) + Drive REST API v3.
// Stores all decks + stats as a single file: integros-decks.json in Drive.
// Scope: drive.file — the app can only access files it created.

(function () {
  // ─── CONFIG ───────────────────────────────────────────────────────────────
  const CLIENT_ID = "907953664355-1v6j2k1rgdi6m1dvv92i18jlp0e1uaga.apps.googleusercontent.com";
  const SCOPE     = "https://www.googleapis.com/auth/drive.file";
  const FILE_NAME = "integros-decks.json";
  const MIME      = "application/json";
  // ──────────────────────────────────────────────────────────────────────────

  let accessToken = null;
  let tokenClient = null;
  let syncBtn      = null;
  let syncStatus   = null;

  // Wait for GIS + Integros to be ready
  function init() {
    if (!window.google || !window.google.accounts || !window.Integros) {
      setTimeout(init, 100);
      return;
    }
    setupUI();
    setupTokenClient();
  }

  function setupUI() {
    syncBtn    = document.getElementById("driveSyncBtn");
    syncStatus = document.getElementById("driveSyncStatus");
    if (!syncBtn) return;
    syncBtn.addEventListener("click", onSyncClick);
    updateBtn("Sign in & sync");
  }

  function setupTokenClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: onTokenResponse,
    });
  }

  function onSyncClick() {
    if (accessToken) {
      // Already signed in — sync immediately
      runSync();
    } else {
      // Trigger Google sign-in popup
      tokenClient.requestAccessToken({ prompt: "consent" });
    }
  }

  function onTokenResponse(resp) {
    if (resp.error) {
      setStatus("Sign-in failed: " + resp.error, "error");
      return;
    }
    accessToken = resp.access_token;
    updateBtn("Syncing…");
    runSync();
  }

  // ─── CORE SYNC LOGIC ──────────────────────────────────────────────────────
  // Strategy: Drive is the source of truth.
  // 1. Look for integros-decks.json in Drive.
  // 2. If found: merge Drive data into localStorage (Drive wins on conflict).
  // 3. Then write merged state back to Drive.
  // 4. If not found: upload current localStorage state as a new file.

  async function runSync() {
    setStatus("Connecting to Drive…", "info");
    updateBtn("Syncing…", true);
    try {
      const fileId = await findFile();

      if (fileId) {
        setStatus("Found existing file — downloading…", "info");
        const driveData = await downloadFile(fileId);
        const merged = mergeStates(driveData);
        await uploadFile(fileId, merged);
        applyToLocal(merged);
        setStatus("Synced! " + countDecks(merged) + " decks up to date.", "ok");
      } else {
        setStatus("No Drive file found — uploading local data…", "info");
        const local = exportLocal();
        const newId = await createFile(local);
        setStatus("Uploaded! " + countDecks(local) + " decks saved to Drive.", "ok");
      }

      updateBtn("Sync with Google Drive");

      // Refresh the deck grid if on explore page
      if (typeof window.renderDecks === "function") window.renderDecks();

    } catch (err) {
      console.error("Drive sync error:", err);
      setStatus("Sync failed: " + (err.message || "unknown error"), "error");
      updateBtn("Retry sync");
    }
  }

  // Search for the file by name in Drive (app-created files only)
  async function findFile() {
    const q = encodeURIComponent("name='" + FILE_NAME + "' and trashed=false");
    const resp = await driveRequest(
      "https://www.googleapis.com/drive/v3/files?q=" + q + "&fields=files(id,name)",
      { method: "GET" }
    );
    const data = await resp.json();
    if (!data.files || !data.files.length) return null;
    return data.files[0].id;
  }

  // Download file content from Drive
  async function downloadFile(fileId) {
    const resp = await driveRequest(
      "https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media",
      { method: "GET" }
    );
    return await resp.json();
  }

  // Update existing file in Drive with new content
  async function uploadFile(fileId, data) {
    await driveRequest(
      "https://www.googleapis.com/upload/drive/v3/files/" + fileId + "?uploadType=media",
      {
        method: "PATCH",
        headers: { "Content-Type": MIME },
        body: JSON.stringify(data),
      }
    );
  }

  // Create a new file in Drive
  async function createFile(data) {
    // Step 1: create metadata
    const metaResp = await driveRequest(
      "https://www.googleapis.com/drive/v3/files",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: FILE_NAME, mimeType: MIME }),
      }
    );
    const meta = await metaResp.json();

    // Step 2: upload content
    await uploadFile(meta.id, data);
    return meta.id;
  }

  // Authenticated fetch wrapper
  async function driveRequest(url, options) {
    const headers = Object.assign({}, options.headers || {}, {
      Authorization: "Bearer " + accessToken,
    });
    const resp = await fetch(url, Object.assign({}, options, { headers }));
    if (!resp.ok && resp.status !== 200) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(
        (errBody.error && errBody.error.message) || "Drive API error " + resp.status
      );
    }
    return resp;
  }

  // ─── STATE HELPERS ────────────────────────────────────────────────────────

  function exportLocal() {
    // Pull raw state from localStorage directly to avoid Integros cache
    try {
      const raw = window.localStorage.getItem("integros-flashcards-v1");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { decks: {}, stats: {} };
  }

  // Merge Drive state with local state.
  // Decks: union of both, Drive wins if same name exists.
  // Stats: keep whichever has higher total for each deck.
  function mergeStates(driveData) {
    const local = exportLocal();
    const mergedDecks = Object.assign({}, local.decks || {}, driveData.decks || {});
    const mergedStats = Object.assign({}, local.stats || {});
    const driveStats  = driveData.stats || {};
    Object.keys(driveStats).forEach(function (deckName) {
      const ds = driveStats[deckName];
      const ls = mergedStats[deckName];
      if (!ls || (ds.total || 0) >= (ls.total || 0)) {
        mergedStats[deckName] = ds;
      }
    });
    return { decks: mergedDecks, stats: mergedStats };
  }

  // Write merged state back to localStorage and invalidate Integros cache
  function applyToLocal(data) {
    try {
      window.localStorage.setItem("integros-flashcards-v1", JSON.stringify(data));
      // Force Integros to reload from localStorage on next call
      if (window.Integros && window.Integros._resetCache) {
        window.Integros._resetCache();
      } else {
        // Fallback: patch stateCache if accessible (it's in closure so we reload)
        window.location.reload();
      }
    } catch (e) {
      console.error("Could not write to localStorage:", e);
    }
  }

  function countDecks(data) {
    return Object.keys((data && data.decks) || {}).length;
  }

  // ─── UI HELPERS ───────────────────────────────────────────────────────────

  function updateBtn(label, disabled) {
    if (!syncBtn) return;
    syncBtn.textContent = label;
    syncBtn.disabled = !!disabled;
  }

  function setStatus(msg, type) {
    if (!syncStatus) return;
    syncStatus.textContent = msg;
    syncStatus.className = "drive-sync-status drive-sync-status--" + (type || "info");
  }

  // Start when DOM + GIS script are ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();