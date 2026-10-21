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

  const quizzes = {
    voltage:{q:"Что показывает напряжение?",options:["Сколько заряда движется за секунду","Разность потенциалов, которая может заставлять заряд двигаться","Сопротивление проводника"],answer:1,why:"Напряжение — это разность электрических потенциалов между двумя точками."},
    current:{q:"Что называют электрическим током?",options:["Упорядоченное движение электрических зарядов","Запас энергии в батарейке","Сопротивление провода"],answer:0,why:"Ток — упорядоченное движение электрических зарядов."},
    resistance:{q:"Если сопротивление растёт при том же напряжении, ток…",options:["Увеличивается","Не меняется","Уменьшается"],answer:2,why:"По закону Ома I = U / R: при неизменном напряжении большему сопротивлению соответствует меньший ток."},
    "ohm-law":{q:"Какая формула закона Ома для участка цепи?",options:["I = U / R","U = I / R","R = I / U"],answer:0,why:"Силу тока находят делением напряжения на сопротивление."},
    "resistor-basics":{q:"Зачем ставят резистор последовательно со светодиодом?",options:["Чтобы ограничить ток","Чтобы увеличить напряжение батарейки","Чтобы изменить полярность"],answer:0,why:"Резистор ограничивает ток и помогает защитить светодиод от перегрузки."},
    "led-basics":{q:"Как называются выводы светодиода?",options:["Коллектор и эмиттер","Анод и катод","Вход и выход"],answer:1,why:"У светодиода есть анод A и катод K; полярность имеет значение."},
    "capacitor-basics":{q:"Что делает конденсатор?",options:["Накапливает электрический заряд","Сам по себе усиливает ток","Всегда блокирует ток при любых условиях"],answer:0,why:"Конденсатор накапливает заряд и часто используется для фильтрации и сглаживания напряжения."},
    "diode-basics":{q:"Как ведёт себя обычный диод?",options:["Проводит одинаково в обе стороны","Проводит преимущественно в одном направлении","Хранит программу"],answer:1,why:"Диод проводит ток в прямом направлении и блокирует его в обратном в пределах своих характеристик."},
    "transistor-basics":{q:"Для чего используют транзистор?",options:["Только для свечения","Только для измерения температуры","Как электронный ключ или усилитель"],answer:2,why:"Транзистор может управлять током нагрузки или усиливать сигнал."},
    "circuit-path":{q:"Что нужно току в простой электрической цепи?",options:["Непрерывный замкнутый путь","Только один провод","Разомкнутый выключатель"],answer:0,why:"Для устойчивого тока нужен замкнутый путь от одного вывода источника к другому."},
    "led-polarity":{q:"Как правильно подключить светодиод в этой учебной цепи?",options:["Катод к плюсу, анод к минусу","Анод к плюсу через резистор, катод к минусу","Полярность не важна"],answer:1,why:"Анод A соединяют с плюсом через резистор, катод K — с минусом."},
    "first-led-circuit":{q:"Что нужно включить последовательно со светодиодом для ограничения тока?",options:["Обязательно катушку","Резистор","Вторую батарейку параллельно"],answer:1,why:"Последовательный резистор ограничивает ток. В реальной схеме также проверяют параметры питания и светодиода."},
    binary:{q:"Какие символы использует двоичная система?",options:["0 и 1","От 0 до 7","От 0 до 9"],answer:0,why:"Двоичная система использует два символа: 0 и 1."},
    "logic-high-low":{q:"Что означают HIGH и LOW в цифровой логике?",options:["Названия компонентов","Логические уровни сигнала","Типы проводов"],answer:1,why:"HIGH и LOW обозначают логические состояния, связанные с диапазонами напряжения."},
    "and-gate":{q:"Когда выход элемента И активен?",options:["Когда активен любой вход","Когда все входы активны","Когда все входы неактивны"],answer:1,why:"Для элемента И все входы должны быть активны, чтобы активным стал выход."},
    "or-gate":{q:"Когда выход элемента ИЛИ активен?",options:["Когда активен хотя бы один вход","Только когда активны все входы","Никогда"],answer:0,why:"Достаточно одного активного входа, чтобы выход ИЛИ стал активным."},
    "not-gate":{q:"Что делает логический элемент НЕ?",options:["Умножает сигнал","Инвертирует логическое состояние","Запоминает сигнал навсегда"],answer:1,why:"НЕ меняет 0 на 1, а 1 на 0."},
    microcontroller:{q:"Что такое микроконтроллер?",options:["Микросхема с процессором и периферией для управления устройством","Обычный резистор","Источник питания без логики"],answer:0,why:"Микроконтроллер выполняет программу и взаимодействует с датчиками и исполнительными устройствами."},
    gpio:{q:"Для чего нужны контакты GPIO?",options:["Для окрашивания платы","Для чтения цифровых сигналов и управления выходами","Для охлаждения микросхемы"],answer:1,why:"GPIO могут работать как цифровые входы или выходы; допустимые уровни зависят от конкретной платы."},
    sensors:{q:"Что делает датчик?",options:["Преобразует физическую величину в сигнал","Всегда хранит данные в интернете","Создаёт энергию без источника"],answer:0,why:"Датчик измеряет температуру, свет, движение и другие величины и выдаёт соответствующий сигнал."},
    pwm:{q:"Для чего часто используют ШИМ?",options:["Для управления средней мощностью с помощью импульсов","Для увеличения числа контактов","Для полного удаления любых помех"],answer:0,why:"ШИМ меняет долю времени, когда сигнал включён, и помогает управлять яркостью или скоростью."},
    power:{q:"Почему важно правильно выбирать питание платы?",options:["Любое напряжение подходит","Неверное напряжение может повредить плату","Питание влияет только на цвет платы"],answer:1,why:"У каждой платы есть допустимые диапазоны напряжения и ограничения по току."},
    project:{q:"Какие части есть у простой системы управления?",options:["Питание, вход/датчик, обработка и выход","Только корпус","Только батарейка"],answer:0,why:"Типичная система получает питание, считывает входные данные, обрабатывает их и управляет выходом."}
  };
\n  const components = [
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
      return '<article class="course-card" id="course-'+m.id+'"><div class="course-number">'+m.number+'</div><div class="course-body"><div class="course-meta"><span class="course-badge">'+m.tag+'</span><span class="course-time">'+m.time+'</span></div><h3>'+m.title+'</h3><p>'+m.description+'</p><div class="course-bottom"><div class="course-progress"><div class="progress-track"><div class="progress-fill" style="width:'+p.percent+'%"></div></div><small>'+p.completed+' из '+m.lessons.length+' заданий завершено</small></div><button class="course-open" type="button" data-open-module="'+m.id+'">Открыть уроки ↓</button></div><div class="lesson-list hidden" id="lessons-'+m.id+'">'+m.lessons.map((lesson,i) => (() => { const quiz = quizzes[lesson[0]]; const choices = quiz ? quiz.options.map((option, optionIndex) => '<label class="quiz-option"><input type="radio" name="quiz-'+lesson[0]+'" value="'+optionIndex+'"><span>'+esc(option)+'</span></label>').join("") : ""; return '<article class="lesson-row" id="lesson-'+lesson[0]+'"><div class="lesson-row-number">'+(i+1)+'</div><div class="lesson-row-content"><strong>'+esc(lesson[1])+'</strong><p>'+esc(lesson[2])+'</p><details class="lesson-quiz"><summary>Проверить себя · мини-тест</summary><div class="quiz-content"><p class="quiz-question">'+esc(quiz ? quiz.q : "Повтори материал урока.")+'</p>'+choices+'<button type="button" class="quiz-check" data-check-quiz="'+lesson[0]+'" data-module="'+m.id+'">Проверить ответ</button><p class="quiz-feedback" data-quiz-feedback="'+lesson[0]+'" aria-live="polite"></p></div></details></div></article>'; })()).join("")+'</div></div></article>';
    }).join("");
    grid.querySelectorAll("[data-open-module]").forEach(btn => btn.addEventListener("click", () => {
      const list = $("lessons-"+btn.dataset.openModule);
      const closed = list.classList.toggle("hidden");
      btn.textContent = closed ? "Открыть уроки ↓" : "Свернуть уроки ↑";
    }));
    grid.querySelectorAll(".quiz-check").forEach(btn => {
      const lessonId = btn.dataset.checkQuiz;
      const moduleId = btn.dataset.module;
      const done = window.GLITCH_LAB && window.GLITCH_LAB.isLessonCompleted(moduleId, lessonId);
      if (done) {
        btn.textContent = "Урок пройден ✓";
        btn.classList.add("done");
      }
      btn.addEventListener("click", () => {
        const quiz = quizzes[lessonId];
        const selected = grid.querySelector('input[name="quiz-'+lessonId+'"]:checked');
        const feedback = () => grid.querySelector('[data-quiz-feedback="'+lessonId+'"]');
        if (!selected) {
          const target = feedback();
          if (target) { target.textContent = "Сначала выбери один вариант ответа."; target.className = "quiz-feedback feedback-neutral"; }
          return;
        }
        if (Number(selected.value) !== quiz.answer) {
          const target = feedback();
          if (target) { target.textContent = "Пока неверно. " + quiz.why; target.className = "quiz-feedback feedback-wrong"; }
          return;
        }
        const result = window.GLITCH_LAB.completeLesson(moduleId, lessonId);
        if (result.ok) {
          const target = feedback();
          if (target) {
            target.textContent = result.alreadyCompleted ? "Верно! Этот урок уже засчитан." : "Верно! +" + result.xpEarned + " XP. " + quiz.why;
            target.className = "quiz-feedback feedback-correct";
          }
          const currentButton = grid.querySelector('[data-check-quiz="'+lessonId+'"]');
          if (currentButton) { currentButton.textContent = "Урок пройден ✓"; currentButton.classList.add("done"); }
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