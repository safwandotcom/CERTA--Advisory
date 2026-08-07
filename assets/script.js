// ---------- Preloader ----------
const preloader = document.getElementById('preloader');
if (preloader) {
  document.documentElement.classList.add('is-loading');
  const shownAt = performance.now();
  const minDisplay = 1800; // ms — deliberate pause so the spinning mark actually registers, not just a flash

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
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
