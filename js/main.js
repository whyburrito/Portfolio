/* ============================================================
   main.js — nav scroll state, active-link highlight, mobile menu
   ============================================================ */

(function () {
  "use strict";

  const nav = document.getElementById("nav");
  const toggle = document.getElementById("navToggle");
  const links = document.querySelector(".nav__links");
  const navLinks = Array.from(document.querySelectorAll(".nav__link"));
  const sections = navLinks
    .map((link) => document.getElementById(link.dataset.target))
    .filter(Boolean);

  /* ---------- Nav background on scroll ---------- */
  function onScrollChrome() {
    nav.classList.toggle("is-scrolled", window.scrollY > 40);
  }

  /* ---------- Active link: section nearest the upper third ---------- */
  function updateActiveLink() {
    if (!sections.length) return;

    const marker = window.innerHeight * 0.28;
    let activeId = sections[0].id;

    for (const section of sections) {
      const top = section.getBoundingClientRect().top;
      if (top <= marker) {
        activeId = section.id;
      }
    }

    // Near page bottom: force last section active
    const scrollBottom = window.scrollY + window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    if (scrollBottom >= docHeight - 40) {
      activeId = sections[sections.length - 1].id;
    }

    navLinks.forEach((link) =>
      link.classList.toggle("is-active", link.dataset.target === activeId)
    );
  }

  function onScroll() {
    onScrollChrome();
    updateActiveLink();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updateActiveLink, { passive: true });
  onScroll();

  /* ---------- Mobile menu toggle ---------- */
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    links.addEventListener("click", (e) => {
      if (e.target.closest(".nav__link")) {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }
})();
