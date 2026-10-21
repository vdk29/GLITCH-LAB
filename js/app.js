
/* ========================================
   GLITCH LAB — CORE APPLICATION
   Progress, XP, levels and local storage
======================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "glitchLabProgress";
  const VERSION = 1;

  const MODULES = {
    basics: {
      title: "Электричество с нуля",
      total: 4,
      xp: 25
    },
    components: {
      title: "Электронные компоненты",
      total: 5,
      xp: 30
    },
    circuit: {
      title: "Первая электрическая схема",
      total: 3,
      xp: 40
    },
    logic: {
      title: "Цифровая логика",
      total: 5,
      xp: 35
    },
    advanced: {
      title: "Микроконтроллеры и платы",
      total: 6,
      xp: 50
    }
  };

  const LEVELS = [
    { xp: 0, title: "Начинающий инженер" },
    { xp: 100, title: "Исследователь электроники" },
    { xp: 250, title: "Младший схемотехник" },
    { xp: 500, title: "Инженер-практик" },
    { xp: 850, title: "Мастер схем" },
    { xp: 1300, title: "Инженер-эксперт" },
    { xp: 1900, title: "Архитектор электроники" },
    { xp: 2700, title: "Легенда GLITCH LAB" }
  ];

  function createDefaultState() {
    return {
      version: VERSION,
      xp: 0,
      completed: {},
      achievements: [],
      dailyQuestionSolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeState(data) {
    const base = createDefaultState();

    if (!data || typeof data !== "object") {
      return base;
    }

    base.xp = Math.max(
      0,
      Math.floor(Number(data.xp) || 0)
    );

    base.completed =
      data.completed &&
      typeof data.completed === "object" &&
      !Array.isArray(data.completed)
        ? data.completed
        : {};

    base.achievements = Array.isArray(data.achievements)
      ? data.achievements.filter(
          item => typeof item === "string"
        )
      : [];

    base.dailyQuestionSolved =
      data.dailyQuestionSolved === true;

    base.createdAt =
      typeof data.createdAt === "string"
        ? data.createdAt
        : base.createdAt;

    base.updatedAt =
      typeof data.updatedAt === "string"
        ? data.updatedAt
        : base.updatedAt;

    return base;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return createDefaultState();
      }

      return normalizeState(JSON.parse(raw));
    } catch (error) {
      console.warn(
        "GLITCH LAB: не удалось прочитать прогресс.",
        error
      );

      return createDefaultState();
    }
  }

  let state = loadState();

  function saveState() {
    state.updatedAt = new Date().toISOString();

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.warn(
        "GLITCH LAB: не удалось сохранить прогресс.",
        error
      );
    }

    window.dispatchEvent(
      new CustomEvent("glitchlab:progress", {
        detail: getProgress()
      })
    );
  }

  function getLevel(xp) {
    let current = 0;

    for (let i = 0; i < LEVELS.length; i++) {
      if (xp >= LEVELS[i].xp) {
        current = i;
      } else {
        break;
      }
    }

    const level = LEVELS[current];
    const next = LEVELS[current + 1] || null;

    const progress = next
      ? Math.min(
          100,
          Math.round(
            ((xp - level.xp) /
              (next.xp - level.xp)) *
              100
          )
        )
      : 100;

    return {
      number: current + 1,
      title: level.title,
      xp: xp,
      currentThreshold: level.xp,
      nextThreshold: next ? next.xp : null,
      nextTitle: next ? next.title : null,
      progress: progress,
      xpToNext: next ? Math.max(0, next.xp - xp) : 0
    };
  }

  function getModuleProgress(moduleId) {
    const module = MODULES[moduleId];

    if (!module) {
      return {
        id: moduleId,
        completed: 0,
        total: 0,
        percent: 0,
        done: false
      };
    }

    const completedItems = Array.isArray(
      state.completed[moduleId]
    )
      ? state.completed[moduleId]
      : [];

    const completedCount = Math.min(
      module.total,
      new Set(completedItems).size
    );

    return {
      id: moduleId,
      title: module.title,
      completed: completedCount,
      total: module.total,
      percent: Math.round(
        (completedCount / module.total) * 100
      ),
      done: completedCount >= module.total
    };
  }

  function getProgress() {
    const moduleProgress = {};
    let totalLessons = 0;
    let completedLessons = 0;

    Object.keys(MODULES).forEach(moduleId => {
      const progress = getModuleProgress(moduleId);

      moduleProgress[moduleId] = progress;
      totalLessons += progress.total;
      completedLessons += progress.completed;
    });

    return {
      xp: state.xp,
      level: getLevel(state.xp),
      completedLessons: completedLessons,
      totalLessons: totalLessons,
      coursePercent: totalLessons
        ? Math.round(
            (completedLessons / totalLessons) * 100
          )
        : 0,
      modules: moduleProgress,
      achievements: [...state.achievements],
      dailyQuestionSolved: state.dailyQuestionSolved,
      updatedAt: state.updatedAt
    };
  }

  function completeLesson(moduleId, lessonId) {
    const module = MODULES[moduleId];

    if (!module) {
      return {
        ok: false,
        reason: "unknown-module"
      };
    }

    const validLessonId = String(lessonId);

    if (!validLessonId.trim()) {
      return {
        ok: false,
        reason: "invalid-lesson"
      };
    }

    if (!state.completed[moduleId]) {
      state.completed[moduleId] = [];
    }

    const completedItems = state.completed[moduleId];

    if (completedItems.includes(validLessonId)) {
      return {
        ok: true,
        alreadyCompleted: true,
        progress: getProgress()
      };
    }

    if (completedItems.length >= module.total) {
      return {
        ok: false,
        reason: "module-complete"
      };
    }

    completedItems.push(validLessonId);

    state.xp += module.xp;

    checkAchievements();
    saveState();

    return {
      ok: true,
      alreadyCompleted: false,
      xpEarned: module.xp,
      progress: getProgress()
    };
  }

  function awardXP(amount, reason) {
    const value = Math.floor(Number(amount));

    if (!Number.isFinite(value) || value <= 0) {
      return {
        ok: false,
        reason: "invalid-xp"
      };
    }

    state.xp += Math.min(value, 1000);

    checkAchievements();
    saveState();

    return {
      ok: true,
      xpEarned: Math.min(value, 1000),
      reason: String(reason || "practice"),
      progress: getProgress()
    };
  }

  function markDailyQuestionSolved() {
    if (state.dailyQuestionSolved) {
      return {
        ok: true,
        alreadyCompleted: true
      };
    }

    state.dailyQuestionSolved = true;
    state.xp += 10;

    checkAchievements();
    saveState();

    return {
      ok: true,
      alreadyCompleted: false,
      xpEarned: 10,
      progress: getProgress()
    };
  }

  function checkAchievements() {
    const progress = getProgress();

    if (
      progress.completedLessons >= 1 &&
      !state.achievements.includes("first_lesson")
    ) {
      state.achievements.push("first_lesson");
    }

    if (
      progress.completedLessons >= 5 &&
      !state.achievements.includes("five_lessons")
    ) {
      state.achievements.push("five_lessons");
    }

    if (
      state.xp >= 100 &&
      !state.achievements.includes("xp_100")
    ) {
      state.achievements.push("xp_100");
    }

    if (
      progress.coursePercent >= 100 &&
      !state.achievements.includes("course_complete")
    ) {
      state.achievements.push("course_complete");
    }
  }

  function resetProgress() {
    state = createDefaultState();
    saveState();

    return getProgress();
  }

  function getModuleDefinitions() {
    return JSON.parse(JSON.stringify(MODULES));
  }

  /*
   * Public API shared by every page.
   *
   * Examples:
   * GLITCH_LAB.getProgress()
   * GLITCH_LAB.completeLesson("basics", "ohm-law")
   * GLITCH_LAB.awardXP(10, "circuit-built")
   */

  window.GLITCH_LAB = Object.freeze({
    version: VERSION,
    getProgress,
    getLevel: () => getLevel(state.xp),
    getModuleProgress,
    getModuleDefinitions,
    completeLesson,
    awardXP,
    markDailyQuestionSolved,
    resetProgress
  });

  /*
   * Other pages can detect that the core is ready.
   */

  window.dispatchEvent(
    new CustomEvent("glitchlab:ready", {
      detail: getProgress()
    })
  );

})();
