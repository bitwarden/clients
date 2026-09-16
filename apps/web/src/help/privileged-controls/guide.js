(function () {
  const toggle = document.getElementById("nav-toggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");

  function openDrawer() {
    sidebar.classList.add("open");
    backdrop.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
  }
  function closeDrawer() {
    sidebar.classList.remove("open");
    backdrop.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }
  toggle.addEventListener("click", function () {
    if (sidebar.classList.contains("open")) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });
  backdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !sidebar.classList.contains("open")) {
      return;
    }
    const focusWasInDrawer = sidebar.contains(document.activeElement);
    closeDrawer();
    if (focusWasInDrawer) {
      toggle.focus();
    }
  });
  sidebar.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      if (window.matchMedia("(max-width: 899.98px)").matches) {
        closeDrawer();
      }
    });
  });

  const sections = Array.prototype.slice.call(document.querySelectorAll("main > section[id]"));
  const navLinks = Array.prototype.slice.call(document.querySelectorAll(".chapter-list a"));
  const railList = document.getElementById("rail-list");

  const chapters = sections.map(function (sec) {
    return {
      id: sec.id,
      el: sec,
      navLink: navLinks.filter(function (a) {
        return a.getAttribute("href") === "#" + sec.id;
      })[0],
      subheads: Array.prototype.slice
        .call(sec.querySelectorAll(":scope > h3[id]"))
        .map(function (h) {
          return { id: h.id, text: h.textContent };
        }),
    };
  });

  let currentActiveId = null;

  function renderRail(chapter) {
    railList.innerHTML = "";
    if (!chapter || !chapter.subheads.length) {
      return;
    }
    chapter.subheads.forEach(function (h) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.text;
      li.appendChild(a);
      railList.appendChild(li);
    });
  }

  function spy() {
    const offset = 96;
    let active = chapters[0];
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].el.getBoundingClientRect().top <= offset) {
        active = chapters[i];
      }
    }
    if (active && active.id !== currentActiveId) {
      currentActiveId = active.id;
      navLinks.forEach(function (a) {
        a.classList.remove("active");
      });
      if (active.navLink) {
        active.navLink.classList.add("active");
      }
      renderRail(active);
    }
  }

  window.addEventListener("scroll", spy, { passive: true });
  window.addEventListener("resize", spy);
  spy();
})();
