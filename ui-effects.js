(() => {
// Shared toast and decorative animation helpers.
function showToast(title, message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast-item toast-${type}`;
  const icon = type === "success" ? "fa-solid fa-circle-check"
    : type === "coral" ? "fa-solid fa-wand-magic-sparkles" : "fa-solid fa-bell";
  toast.innerHTML = `
    <div class="toast-icon"><i class="${icon}"></i></div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-desc">${message}</div>
    </div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => toast.remove(), 260);
  }, 4200);
}

function animateCounter(element, target, duration = 1400) {
  if (!element) return;
  const startTime = performance.now();
  function updateCount(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    element.textContent = Math.floor(target * easeOut);
    if (progress < 1) requestAnimationFrame(updateCount);
    else element.textContent = target;
  }
  requestAnimationFrame(updateCount);
}

function triggerStatsCounters() {
  const reunited = document.getElementById("statCountReunited");
  const waiting = document.getElementById("statCountWaiting");
  if (reunited) animateCounter(reunited, parseInt(reunited.dataset.target, 10));
  if (waiting) animateCounter(waiting, parseInt(waiting.dataset.target, 10));
}

function initHeroParallax() {
  const heroCard = document.querySelector(".hero-graphic-card");
  const backpackArt = document.getElementById("heroBackpackArt");
  const badgeTag = document.querySelector(".graphic-badge-tag");
  if (!heroCard || !backpackArt) return;

  heroCard.addEventListener("mousemove", event => {
    const rect = heroCard.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    backpackArt.style.transform = `perspective(600px) rotateX(${(y / rect.height) * -16}deg) rotateY(${(x / rect.width) * 16}deg) translateY(-8px)`;
    if (badgeTag) badgeTag.style.transform = `rotate(-5deg) translate(${x * 0.08}px, ${y * 0.08}px)`;
  });
  heroCard.addEventListener("mouseleave", () => {
    backpackArt.style.transform = "";
    if (badgeTag) badgeTag.style.transform = "";
  });
}

window.showToast = showToast;
window.triggerStatsCounters = triggerStatsCounters;
window.initHeroParallax = initHeroParallax;
})();
