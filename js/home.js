
(function () {
  "use strict";

  function initHome() {
    const app = window.GLITCH_LAB;

    if (!app) {
      console.error("GLITCH LAB: не найден js/app.js");
      return;
    }

    const $ = (id) => document.getElementById(id);

    const modules = [
      { id: "basics", suffix: 1, total: 4 },
      { id: "components", suffix: 2, total: 5 },
      { id: "circuit", suffix: 3, total: 3 },
      { id: "logic", suffix: 4, total: 5 },
      { id: "advanced", suffix: 5, total: 6 }
    ];

    function setText(id, value) {
      const element = $(id);
      if (element) element.textContent = value;
    }

    function setProgress(id, percent) {
      const element = $(id);
      if (!element) return;

      const value = Math.max(0, Math.min(100, percent));
      element.style.width = value + "%";
      element.setAttribute("role", "progressbar");
      element.setAttribute("aria-valuemin", "0");
      element.setAttribute("aria-valuemax", "100");
      element.setAttribute("aria-valuenow", String(value));
    }

    function renderStats() {
      const progress = app.getProgress();

      setText("xpValue", progress.xp);
      setText("completedValue", progress.completedLessons);

      const level = app.getLevel(progress.xp);

      setText("levelValue", level.title);
      setText(
        "levelDescription",
        level.next
          ? "Ещё " + Math.max(0, level.next.xp - progress.xp) +
            " XP до следующего уровня"
          : "Ты достиг максимального уровня!"
      );

      setText("progressValue", progress.percent + "%");
      setProgress("courseProgress", progress.percent);
    }

    function renderModules() {
      modules.forEach(function (module) {
        const data = app.getModuleProgress(module.id);
        const percent = data.percent || 0;
        const suffix = module.suffix;

        setProgress("moduleProgress" + suffix, percent);

        setText(
          "moduleText" + suffix,
          data.completed + " из " + module.total + " заданий"
        );
      });
    }

    function render() {
      renderStats();
      renderModules();
    }

    function initDailyQuestion() {
      const button = $("dailyQuestionButton");
      const answer = $("dailyAnswer");

      if (!button || !answer) return;

      answer.classList.add("hidden");
      button.setAttribute("aria-expanded", "false");

      button.addEventListener("click", function () {
        const isHidden = answer.classList.contains("hidden");

        if (isHidden) {
          answer.classList.remove("hidden");
          button.setAttribute("aria-expanded", "true");

          const result = app.markDailyQuestionSolved();

          if (result && result.awarded) {
            button.textContent = "Ответ изучен · +10 XP";

            const feedback = document.createElement("p");
            feedback.className = "feedback feedback-success";
            feedback.textContent = "Отлично! Ты получил 10 опыта.";
            feedback.setAttribute("data-daily-feedback", "");

            const oldFeedback = answer.querySelector(
              "[data-daily-feedback]"
            );

            if (oldFeedback) oldFeedback.remove();
            answer.appendChild(feedback);
          } else {
            button.textContent = "Ответ уже изучен ✓";
          }
        } else {
          answer.classList.add("hidden");
          button.setAttribute("aria-expanded", "false");
        }
      });
    }

    function initProfileButton() {
      const button = $("profileButton");
      if (!button) return;

      let panel = null;

      button.addEventListener("click", function () {
        if (panel) {
          panel.remove();
          panel = null;
          button.setAttribute("aria-expanded", "false");
          return;
        }

        panel = document.createElement("div");
        panel.className = "card";
        panel.setAttribute("role", "status");
        panel.style.position = "absolute";
        panel.style.zIndex = "20";
        panel.style.top = "calc(100% + 10px)";
        panel.style.right = "0";
        panel.style.width = "min(290px, calc(100vw - 32px))";
        panel.style.padding = "18px";
        panel.style.boxShadow = "0 12px 32px rgba(40, 60, 90, 0.14)";

        const heading = document.createElement("strong");
        heading.textContent = "Твой профиль";

        const description = document.createElement("p");
        description.className = "muted small";
        description.textContent =
          "Пока без регистрации. Твой опыт и пройденные задания хранятся в этом браузере.";

        const close = document.createElement("button");
        close.type = "button";
        close.className = "btn btn-secondary btn-sm";
        close.textContent = "Закрыть";
        close.addEventListener("click", function () {
          panel.remove();
          panel = null;
          button.setAttribute("aria-expanded", "false");
        });

        panel.append(heading, description, close);

        const parent = button.parentElement;
        if (parent) {
          if (getComputedStyle(parent).position === "static") {
            parent.style.position = "relative";
          }
          parent.appendChild(panel);
        }

        button.setAttribute("aria-expanded", "true");
      });
    }

    render();
    initDailyQuestion();
    initProfileButton();

    window.addEventListener("glitchlab:progress", render);
    window.addEventListener("storage", function (event) {
      if (event.key === "glitchLabProgress") render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHome);
  } else {
    initHome();
  }
})();
