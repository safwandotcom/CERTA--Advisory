const navToggle = document.getElementById('navToggle');
const navClose = document.getElementById('navClose');
const mobileNav = document.getElementById('mobileNav');

function openNav() {
  mobileNav.classList.add('is-open');
  navToggle.setAttribute('aria-expanded', 'true');
}

function closeNav() {
  mobileNav.classList.remove('is-open');
  navToggle.setAttribute('aria-expanded', 'false');
}

navToggle.addEventListener('click', openNav);
navClose.addEventListener('click', closeNav);
mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeNav));

// ---------- Scroll reveal ----------
// Default CSS state is visible; html.js arms the hidden pre-reveal state (see styles.css),
// so this only has to add .is-visible as each element enters view.
const revealEls = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window && revealEls.length) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
  );
  revealEls.forEach((el) => revealObserver.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('is-visible'));
}

// ---------- Parallax ----------
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const parallaxEls = Array.from(document.querySelectorAll('[data-parallax]'));

if (!reducedMotion && parallaxEls.length) {
  let ticking = false;

  function updateParallax() {
    const viewportH = window.innerHeight;
    parallaxEls.forEach((el) => {
      const speed = parseFloat(el.getAttribute('data-speed')) || 0.08;
      const rect = el.getBoundingClientRect();
      const centerOffset = rect.top + rect.height / 2 - viewportH / 2;
      el.style.transform = `translateY(${(-centerOffset * speed).toFixed(1)}px)`;
    });
    ticking = false;
  }

  function requestTick() {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  updateParallax();
}
