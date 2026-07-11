/* ============================================================
   scroll.js — IntersectionObserver reveal with stagger delays
   ============================================================ */

(function () {
  "use strict";

  const revealEls = document.querySelectorAll(".reveal");

  // Stagger siblings that share the same parent for a cascade effect
  const groups = new Map();
  revealEls.forEach((el) => {
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, 0);
    const index = groups.get(parent);
    el.style.transitionDelay = `${Math.min(index * 90, 450)}ms`;
    groups.set(parent, index + 1);
  });

  if (!("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -60px 0px",
    }
  );

  revealEls.forEach((el) => observer.observe(el));
})();
