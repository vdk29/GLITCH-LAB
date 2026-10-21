/* GLITCH LAB — course list and searchable component reference */
(function () {
  "use strict";
  const modules = [
    { id:"basics", number:"01", title:"Электричество с нуля", tag:"БАЗА", time:"15–20 минут", description:"Напряжение, ток, сопротивление и закон Ома. Что заставляет электронику работать?", lessons:[
      ["voltage","Напряжение: энергия заряда","Напряжение показывает, насколько сильно источник «толкает» электрические заряды."],
      ["current","Электрический ток","Ток — упорядоченное движение электрических зарядов по замкнутому пути."],
      ["resistance","Сопротивление","Сопротивление ограничивает ток. Чем оно выше при том же напряжении, тем ток меньше."],
      ["ohm-law","Закон Ома","Ток равен напряжению, делённому на сопротивление: I = U / R."]
    ]},
    { id:"components", number:"02", title:"Электронные компоненты", tag:"ДЕТАЛИ", time:"20–25 минут", description:"Научись узнавать основные детали и понимать, для чего каждая нужна.", lessons:[
      ["resistor-basics","Резистор","Ограничивает ток и помогает задавать режим работы других деталей."],
      ["led-basics","Светодиод","Преобразует электрическую энергию в свет и обычно проводит ток только в одном направлении."],
      ["capacitor-basics","Конденсатор","Накапливает электрический заряд и помогает сглаживать изменения напряжения."],
      ["diode-basics","Диод","Пропускает ток преимущественно в одном направлении."],
      ["transistor-basics","Транзистор","Может работать как электронный ключ или усиливать сигнал."]
    ]},
    { id:"circuit", number:"03", title:"Первая электрическая схема", tag:"ПРАКТИКА", time:"20 минут", description:"Соедини источник питания, резистор и светодиод в замкнутую цепь.", lessons:[
      ["circuit-path","Что такое замкнутая цепь","Току нужен непрерывный путь от одного вывода источника к другому."],
      ["led-polarity","Полярность светодиода","Анод подключают к более высокому потенциалу, катод — к более низкому."],
      ["first-led-circuit","Зажги светодиод","Собери цепь с резистором и проверь её в лаборатории."]
    ]},
    { id:"logic", number:"04", title:"Цифровая логика", tag:"ЛОГИКА", time:"25 минут", description:"Разберись, как электронные устройства представляют сигналы 0 и 1.", lessons:[
      ["binary","Двоичная система","Цифровые схемы используют два логических состояния."],
      ["logic-high-low","HIGH и LOW","Логические уровни обозначают разные диапазоны напряжения."],
      ["and-gate","Элемент И","Выход активен, когда все входы активны."],
      ["or-gate","Элемент ИЛИ","Выход активен, когда активен хотя бы один вход."],
      ["not-gate","Элемент НЕ","Инвертирует логическое состояние входа."]
    ]},
    { id:"advanced", number:"05", title:"Микроконтроллеры и платы", tag:"СЛЕДУЮЩИЙ УРОВЕНЬ", time:"30 минут", description:"Первый взгляд на платы, датчики и программируемые устройства.", lessons:[
      ["microcontroller","Что такое микроконтроллер","Маленький компьютер, который управляет устройством по программе."],
      ["gpio","Входы и выходы GPIO","Контакты микроконтроллера считывают сигналы и управляют компонентами."],
      ["sensors","Датчики","Датчики превращают физические величины в электрические сигналы."],
      ["pwm","ШИМ","Широтно-импульсная модуляция помогает управлять средней мощностью."],
      ["power","Питание платы","Разные платы требуют подходящего напряжения и допустимого тока."],
      ["project","Первый мини-проект","Собери план устройства: питание, вход, обработка и выход."]
    ]}
  ];
  const components = [
    {name:"Резистор",symbol:"Ω",category:"passive",label:"ПАССИВНЫЙ КОМПОНЕНТ",description:"Ограничивает ток и создаёт падение напряжения. Один из самых часто используемых элементов.",role:"Защита светодиодов, делители напряжения, подтяжка входов.",use:"В серии со светодиодом ограничивает ток.",query:"resistor"},
    {name:"Конденсатор",symbol:"║",category:"passive",label:"ПАССИВНЫЙ КОМПОНЕНТ",description:"Накапливает заряд в электрическом поле и может сглаживать быстрые изменения напряжения.",role:"Фильтрация питания, задержки, разделение сигналов.",use:"Рядом с питанием микросхемы уменьшает помехи.",query:"capacitor"},
    {name:"Катушка индуктивности",symbol:"∿",category:"passive",label:"ПАССИВНЫЙ КОМПОНЕНТ",description:"Создаёт магнитное поле при протекании тока и противодействует быстрым изменениям тока.",role:"Фильтры, преобразователи питания, радиотехника.",use:"Часто встречается в импульсных источниках питания.",query:"inductor"},
    {name:"Светодиод",symbol:"↗",category:"semiconductor",label:"ПОЛУПРОВОДНИК",description:"Излучает свет при прохождении тока в прямом направлении. Важно соблюдать полярность.",role:"Индикаторы, освещение, оптические сигналы.",use:"Подключай через ограничивающий резистор.",query:"led"},
    {name:"Диод",symbol:"▷",category:"semiconductor",label:"ПОЛУПРОВОДНИК",description:"Проводит ток преимущественно в одном направлении и блокирует его в обратном.",role:"Защита от переполюсовки, выпрямление переменного тока.",use:"Проверь направление диода перед включением.",query:"diode"},
    {name:"Транзистор",symbol:"N",category:"semiconductor",label:"ПОЛУПРОВОДНИК",description:"Управляет током: может работать как ключ или усиливать электрический сигнал.",role:"Управление моторами, светодиодами и другими нагрузками.",use:"Небольшой сигнал может управлять более значительной нагрузкой.",query:"transistor"},
    {name:"Выключатель",symbol:"↗",category:"control",label:"УПРАВЛЕНИЕ ЦЕПЬЮ",description:"Механически замыкает или размыкает цепь, позволяя остановить или запустить ток.",role:"Включение питания, ручное управление, режимы работы.",use:"Разомкнутый выключатель прерывает путь тока.",query:"switch"},
    {name:"Микроконтроллер",symbol:"µ",category:"control",label:"ПРОГРАММИРУЕМОЕ УПРАВЛЕНИЕ",description:"Выполняет программу, читает датчики и управляет выходами устройства.",role:"Автоматика, роботы, умные устройства, измерительные приборы.",use:"GPIO-контакты связывают программу с внешней схемой.",query:"microcontroller"}
  ];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function renderLessons() {
    const grid = $("courseGrid");
    if (!grid) return;
    const progress = window.GLITCH_LAB ? window.GLITCH_LAB.getProgress() : {completedLessons:0,totalLessons:23,coursePercent:0};
    $("lessonCount").textContent = progress.completedLessons;
    $("lessonProgress").style.width = progress.coursePercent + "%";
    $("progressPercent").textContent = progress.coursePercent + "% завершено";
    const level = progress.level || {title:"Начинающий инженер"};
    $("progressTitle").textContent = level.title;
    $("progressSubtitle").textContent = "Пройдено " + progress.completedLessons + " из " + progress.totalLessons + " заданий. Продолжай в своём темпе.";
    const selectedModule = new URLSearchParams(location.search).get("module");
    grid.innerHTML = modules.filter(m => !selectedModule || m.id === selectedModule).map(m => {
      const p = window.GLITCH_LAB ? window.GLITCH_LAB.getModuleProgress(m.id) : {completed:0,percent:0};
      return '<article class="course-card" id="course-'+m.id+'"><div class="course-number">'+m.number+'</div><div class="course-body"><div class="course-meta"><span class="course-badge">'+m.tag+'</span><span class="course-time">'+m.time+'</span></div><h3>'+m.title+'</h3><p>'+m.description+'</p><div class="course-bottom"><div class="course-progress"><div class="progress-track"><div class="progress-fill" style="width:'+p.percent+'%"></div></div><small>'+p.completed+' из '+m.lessons.length+' заданий завершено</small></div><button class="course-open" type="button" data-open-module="'+m.id+'">Открыть уроки ↓</button></div><div class="lesson-list hidden" id="lessons-'+m.id+'">'+m.lessons.map((lesson,i) => '<article class="lesson-row"><div class="lesson-row-number">'+(i+1)+'</div><div class="lesson-row-content"><strong>'+esc(lesson[1])+'</strong><p>'+esc(lesson[2])+'</p></div><button type="button" class="lesson-complete" data-module="'+m.id+'" data-lesson="'+lesson[0]+'">Отметить пройденным</button></article>').join("")+'</div></div></article>';
    }).join("");
    grid.querySelectorAll("[data-open-module]").forEach(btn => btn.addEventListener("click", () => {
      const list = $("lessons-"+btn.dataset.openModule);
      const closed = list.classList.toggle("hidden");
      btn.textContent = closed ? "Открыть уроки ↓" : "Свернуть уроки ↑";
    }));
    grid.querySelectorAll(".lesson-complete").forEach(btn => {
      const completed = window.GLITCH_LAB && window.GLITCH_LAB.getModuleProgress(btn.dataset.module);
      const state = window.GLITCH_LAB && window.GLITCH_LAB.getProgress();
      const done = state && state.modules[btn.dataset.module];
      // The core exposes counts rather than IDs; use a local marker for the UI and let completeLesson prevent duplicate XP.
      const key = "glitchLessonUI:" + btn.dataset.module + ":" + btn.dataset.lesson;
      if (localStorage.getItem(key) === "1") { btn.textContent = "Пройдено ✓"; btn.classList.add("done"); }
      btn.addEventListener("click", () => {
        const result = window.GLITCH_LAB.completeLesson(btn.dataset.module, btn.dataset.lesson);
        if (result.ok) {
          localStorage.setItem(key,"1");
          btn.textContent = result.alreadyCompleted || btn.classList.contains("done") ? "Пройдено ✓" : "Пройдено · +" + result.xpEarned + " XP";
          btn.classList.add("done");
          renderLessons();
          if (window.GLITCH_LAB) window.dispatchEvent(new Event("glitchlab:progress"));
        }
      });
    });
  }

  let activeFilter = "all";
  function renderComponents() {
    const catalog = $("componentCatalog");
    if (!catalog) return;
    const search = ($("componentSearch").value || "").trim().toLocaleLowerCase("ru");
    const visible = components.filter(c => (activeFilter === "all" || c.category === activeFilter) && (c.name+" "+c.description+" "+c.role+" "+c.use).toLocaleLowerCase("ru").includes(search));
    catalog.innerHTML = visible.map(c => '<article class="component-card"><div class="component-card-top"><div class="component-symbol">'+esc(c.symbol)+'</div><div><h3>'+esc(c.name)+'</h3><span class="component-label">'+esc(c.label)+'</span></div></div><p>'+esc(c.description)+'</p><div class="component-detail"><strong>Для чего нужен</strong><p>'+esc(c.role)+'</p></div><div class="component-detail" style="margin-top:10px"><strong>На практике</strong><p>'+esc(c.use)+'</p></div><a class="component-use" href="lab.html">Попробовать в лаборатории →</a></article>').join("");
    $("emptySearch").classList.toggle("hidden", visible.length > 0);
  }

  if ($("courseGrid")) {
    renderLessons();
    window.addEventListener("glitchlab:progress", renderLessons);
  }
  if ($("componentCatalog")) {
    $("componentSearch").addEventListener("input", renderComponents);
    document.querySelectorAll("[data-filter]").forEach(btn => btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(item => item.classList.toggle("active", item === btn));
      renderComponents();
    }));
    renderComponents();
  }
})();