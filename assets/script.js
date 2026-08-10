const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Preloader ----------
const preloader = document.getElementById('preloader');
if (preloader) {
  document.documentElement.classList.add('is-loading');
  const shownAt = performance.now();
  // ms — the draw-on sequence itself is ~900ms (600ms ring + 150ms dash-snap + 150ms hold);
  // minDisplay adds a short settle so the completed mark registers before the iris opens.
  const minDisplay = 1400;

  const preloaderMark = preloader.querySelector('.preloader__mark');
  if (preloaderMark && !reducedMotion) {
    // Double rAF: wait a frame so the browser has committed the initial (undrawn) state
    // before adding the class that transitions it, so the transition actually plays.
    requestAnimationFrame(() => requestAnimationFrame(() => preloaderMark.classList.add('is-drawing')));
  }

  function hidePreloader() {
    const elapsed = performance.now() - shownAt;
    const wait = Math.max(0, minDisplay - elapsed);
    setTimeout(() => {
      preloader.classList.add('is-hidden');
      document.documentElement.classList.remove('is-loading');
    }, wait);
  }

  if (document.readyState === 'complete') {
    hidePreloader();
  } else {
    window.addEventListener('load', hidePreloader);
  }
}

const navToggle = document.getElementById('navToggle');
const navClose = document.getElementById('navClose');
const mobileNav = document.getElementById('mobileNav');

function openNav() {
  mobileNav.classList.add('is-open');
  document.documentElement.classList.add('nav-open');
  navToggle.setAttribute('aria-expanded', 'true');
}

function closeNav() {
  mobileNav.classList.remove('is-open');
  document.documentElement.classList.remove('nav-open');
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

// ---------- Header: transparent-over-hero, solid once scrolled ----------
const siteHeader = document.querySelector('.site-header');
function updateHeaderState() {
  siteHeader.classList.toggle('is-scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', updateHeaderState, { passive: true });
updateHeaderState();

// ---------- Motion: idle float + scroll parallax ----------
// Unified into one rAF loop per element so float (continuous) and parallax (scroll-linked)
// compose into a single transform instead of two writers fighting over the same property.
const motionEls = Array.from(document.querySelectorAll('[data-parallax], [data-float]'));

if (!reducedMotion && motionEls.length) {
  const start = performance.now();
  let rafId = null;

  function tick(now) {
    const elapsed = (now - start) / 1000;
    const viewportH = window.innerHeight;

    motionEls.forEach((el) => {
      let y = 0;
      let rot = 0;

      if (el.hasAttribute('data-parallax')) {
        const speed = parseFloat(el.getAttribute('data-speed')) || 0.08;
        const rect = el.getBoundingClientRect();
        const centerOffset = rect.top + rect.height / 2 - viewportH / 2;
        y += -centerOffset * speed;
      }

      if (el.hasAttribute('data-float')) {
        const amp = parseFloat(el.getAttribute('data-float-amp')) || 16;
        const period = parseFloat(el.getAttribute('data-float-period')) || 4.5;
        const phase = parseFloat(el.getAttribute('data-float-phase')) || 0;
        y += Math.sin((elapsed / period) * Math.PI * 2 + phase) * amp;

        const rotAmp = parseFloat(el.getAttribute('data-float-rotate'));
        if (rotAmp) {
          rot = Math.sin((elapsed / (period * 1.4)) * Math.PI * 2 + phase) * rotAmp;
        }
      }

      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)${rot ? ` rotate(${rot.toFixed(2)}deg)` : ''}`;
    });

    rafId = requestAnimationFrame(tick);
  }

  // Pause the loop when the tab is backgrounded — pure battery/CPU saving on phones
  // (a background tab doesn't need its idle-float mark still animating).
  function startLoop() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }
  function stopLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else startLoop();
  });

  startLoop();
}

// ---------- World clock (UK / BD live time) ----------
const worldClockCards = document.querySelectorAll('.world-clock__card');
if (worldClockCards.length) {
  const clockFormatters = new Map();

  function clockPartsFor(timeZone) {
    if (!clockFormatters.has(timeZone)) {
      clockFormatters.set(
        timeZone,
        new Intl.DateTimeFormat('en-GB', {
          timeZone,
          hourCycle: 'h23',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          weekday: 'short',
        })
      );
    }
    const parts = clockFormatters.get(timeZone).formatToParts(new Date());
    const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return {
      hour: get('hour'),
      minute: get('minute'),
      second: get('second'),
      weekday: parts.find((p) => p.type === 'weekday')?.value ?? '',
    };
  }

  function updateWorldClocks() {
    worldClockCards.forEach((card) => {
      const timeZone = card.getAttribute('data-tz');
      const { hour, minute, second, weekday } = clockPartsFor(timeZone);

      const hourHand = card.querySelector('.world-clock__hand--hour');
      const minuteHand = card.querySelector('.world-clock__hand--minute');
      hourHand.style.transform = `rotate(${((hour % 12) + minute / 60) * 30}deg)`;
      minuteHand.style.transform = `rotate(${(minute + second / 60) * 6}deg)`;

      card.querySelector('[data-time]').textContent =
        `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

      const isWeekday = weekday !== 'Sat' && weekday !== 'Sun';
      const isBusinessHour = hour >= 9 && hour < 18;
      const isOpen = isWeekday && isBusinessHour;

      const statusEl = card.querySelector('[data-status]');
      statusEl.innerHTML = `<span class="dot"></span> ${isOpen ? 'Business hours' : 'After hours'}`;
      statusEl.classList.toggle('is-open', isOpen);

      card.classList.toggle('is-night', hour < 6 || hour >= 20);
    });
  }

  updateWorldClocks();
  setInterval(updateWorldClocks, 1000);
}

// ---------- Process stat count-up ----------
// Default markup already shows the final value (progressive enhancement, matching the
// [data-reveal] philosophy in styles.css): only reset to 0 and animate back up once
// html.js is armed, IntersectionObserver is available, and reduced-motion isn't set.
const countEls = document.querySelectorAll('[data-count-to]');
if (!reducedMotion && 'IntersectionObserver' in window && countEls.length) {
  const countDuration = 900; // ms

  function animateCount(el) {
    const target = parseInt(el.getAttribute('data-count-to'), 10) || 0;
    const suffix = el.getAttribute('data-count-suffix') || '';
    const start = performance.now();

    function step(now) {
      const progress = Math.min(1, (now - start) / countDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      el.textContent = `${value}${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = `${target}${suffix}`;
      }
    }
    requestAnimationFrame(step);
  }

  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const suffix = entry.target.getAttribute('data-count-suffix') || '';
          entry.target.textContent = `0${suffix}`;
          animateCount(entry.target);
          countObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  countEls.forEach((el) => countObserver.observe(el));
}
