// Simple toast notification utility
//
// This module injects a small toast element into the DOM and exposes
// a showToast(message, ok) function on the global namespace.  It
// displays messages in the bottom right corner of the screen and
// automatically hides them after a few seconds.  The 'ok' flag
// selects a green (success) or red (error) background.

(function () {
  // Create the toast element once and append it to the body
  const toast = document.createElement("div");
  toast.id = "toast";
  toast.style.position = "fixed";
  toast.style.bottom = "1rem";
  toast.style.right = "1rem";
  toast.style.padding = "0.75rem 1rem";
  toast.style.borderRadius = "0.375rem";
  toast.style.fontSize = "0.875rem";
  toast.style.fontWeight = "500";
  toast.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.3)";
  toast.style.color = "#ffffff";
  toast.style.display = "none";
  toast.style.zIndex = "9999";
  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(toast);
  });

  let hideTimer = null;

  function showToast(message, ok = true) {
    if (!toast) return;
    toast.textContent = message;
    toast.style.backgroundColor = ok ? "#34d399" /* green */ : "#ef4444"; /* red */
    toast.style.display = "block";
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      toast.style.display = "none";
    }, 3000);
  }

  // Expose on the window so other scripts can call showToast()
  window.showToast = showToast;
})();