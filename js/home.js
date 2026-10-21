/* GLITCH LAB — home page interactions */
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
      const value = Math.max(0, Math.min(100, Number(percent) || 0));
      element.style.width = value + "%";
      element.setAttribute("role", "progressbar");
      element.setAttribute("aria-valuemin", "0");
      element.setAttribute("aria-valuemax", "100");
      element.setAttribute("aria-valuenow", String(value));
    }

    function renderStats() {
      const progress = app.getProgress();
      const level = progress.level || app.getLevel();

      setText("xpValue", progress.xp);
      setText("completedValue", progress.completedLessons);
      setText("levelValue", level.number);
      setText(
        "levelDescription",
        level.nextThreshold !== null
          ? level.title + " · ещё " + level.xpToNext + " XP до следующего уровня"
          : level.title + " · максимальный уровень"
      );
      setText("progressValue", progress.coursePercent);
      setProgress("courseProgress", progress.coursePercent);
    }

    function renderModules() {
      modules.forEach(function (module) {
        const data = app.getModuleProgress(module.id);
        setProgress("moduleProgress" + module.suffix, data.percent);
        setText("moduleText" + module.suffix, data.completed + " из " + module.total + " заданий");
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
        if (!isHidden) {
          answer.classList.add("hidden");
          button.setAttribute("aria-expanded", "false");
          return;
        }

        answer.classList.remove("hidden");
        button.setAttribute("aria-expanded", "true");
        const result = app.markDailyQuestionSolved();

        if (result && result.ok && !result.alreadyCompleted) {
          button.textContent = "Ответ изучен · +10 XP";
          let feedback = answer.querySelector("[data-daily-feedback]");
          if (!feedback) {
            feedback = document.createElement("p");
            feedback.className = "feedback feedback-success";
            feedback.setAttribute("data-daily-feedback", "");
            answer.appendChild(feedback);
          }
          feedback.textContent = "Отлично! Ты получил 10 опыта.";
        } else {
          button.textContent = "Ответ уже изучен ✓";
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
        description.textContent = "Пока без регистрации. Твой опыт и пройденные задания хранятся в этом браузере.";
        const close = document.createElement("button");
        close.type = "button";
        close.className = "btn btn-secondary btn-sm";
        close.textContent = "Закрыть";
        close.addEventListener("click", function () {
          if (panel) panel.remove();
          panel = null;
          button.setAttribute("aria-expanded", "false");
        });

        panel.append(heading, description, close);
        const parent = button.parentElement;
        if (parent) {
          if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
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