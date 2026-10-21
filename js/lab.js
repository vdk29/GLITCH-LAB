/* GLITCH LAB — first interactive circuit sandbox */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const grid = $("componentGrid");
  const board = $("board");
  const wireLayer = $("wireLayer");
  const resultBox = $("simulationResult");
  const hint = $("connectionHint");

  const CIRCUIT_STORAGE_KEY = "glitchLabSavedCircuit";
  let nextId = 1;
  let selectedTerminal = null;
  let batteryVoltage = 5;
  let resistorOhms = 220;
  let wires = [];
  let solved = false;
  let currentFlow = false;
  let parts = [
    { id: "battery", type: "battery", title: "Батарейка 5 В", subtitle: "Источник постоянного напряжения", terminals: [{ id: "plus", label: "+", positive: true }, { id: "minus", label: "−" }] }
  ];

  const types = {
    resistor: { title: "Резистор", subtitle: "220 Ω · ограничивает ток", terminals: [{ id: "a", label: "1" }, { id: "b", label: "2" }] },
    led: { title: "Светодиод", subtitle: "A — анод · K — катод", terminals: [{ id: "a", label: "A", positive: true }, { id: "k", label: "K" }] },
    switch: { title: "Выключатель", subtitle: "Нажми, чтобы переключить", terminals: [{ id: "a", label: "1" }, { id: "b", label: "2" }] }
  };

  function terminalKey(partId, terminalId) { return partId + ":" + terminalId; }

  function saveCircuit() {
    try {
      localStorage.setItem(CIRCUIT_STORAGE_KEY, JSON.stringify({
        nextId,
        batteryVoltage,
        resistorOhms,
        parts: parts.map((part) => ({ id: part.id, type: part.type, closed: Boolean(part.closed) })),
        wires
      }));
    } catch (error) {
      console.warn("GLITCH LAB: не удалось сохранить схему.", error);
    }
  }

  function restoreCircuit() {
    try {
      const raw = localStorage.getItem(CIRCUIT_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.parts) || !Array.isArray(saved.wires)) return;

      batteryVoltage = [3, 5, 9].includes(Number(saved.batteryVoltage)) ? Number(saved.batteryVoltage) : 5;
      resistorOhms = [100, 220, 330, 1000].includes(Number(saved.resistorOhms)) ? Number(saved.resistorOhms) : 220;
      const restoredParts = [{
        id: "battery",
        type: "battery",
        title: "Батарейка " + batteryVoltage + " В",
        subtitle: "Источник постоянного напряжения",
        terminals: [{ id: "plus", label: "+", positive: true }, { id: "minus", label: "−" }]
      }];

      saved.parts.forEach((item) => {
        if (!item || item.id === "battery" || !types[item.type]) return;
        const definition = types[item.type];
        if (restoredParts.filter((part) => part.type === item.type).length >= 4) return;
        restoredParts.push({
          id: String(item.id),
          type: item.type,
          title: definition.title,
          subtitle: definition.subtitle,
          terminals: definition.terminals.map((terminal) => ({ ...terminal })),
          closed: Boolean(item.closed)
        });
      });

      const validKeys = new Set(restoredParts.flatMap((part) => part.terminals.map((terminal) => terminalKey(part.id, terminal.id))));
      const restoredWires = saved.wires.filter((wire) =>
        wire && validKeys.has(wire.a) && validKeys.has(wire.b) &&
        wire.a.split(":")[0] !== wire.b.split(":")[0]
      ).map((wire) => ({ a: wire.a, b: wire.b }));

      parts = restoredParts;
      wires = restoredWires;
      nextId = Math.max(Number(saved.nextId) || 1, 1);
    } catch (error) {
      console.warn("GLITCH LAB: сохранённая схема повреждена, начинаем заново.", error);
    }
  }
  function getPart(id) { return parts.find((part) => part.id === id); }
  function countText(n) { return n + " " + (n === 1 ? "деталь" : n < 5 ? "детали" : "деталей"); }

  function addPart(type) {
    if (!types[type]) return;
    if (parts.filter((part) => part.type === type).length >= 4) {
      showResult("warning", "Пока достаточно деталей", "Для этого первого эксперимента можно добавить не больше четырёх одинаковых компонентов.");
      return;
    }
    const definition = types[type];
    currentFlow = false;
    parts.push({
      id: type + "-" + nextId++,
      type,
      title: definition.title,
      subtitle: definition.subtitle,
      terminals: definition.terminals.map((terminal) => ({ ...terminal })),
      closed: false
    });
    saveCircuit();
    render();
    showResult("", "Компонент добавлен", definition.title + " появился на плате. Теперь соедини его контакты проводами.");
  }

  function render() {
    grid.innerHTML = "";
    parts.forEach((part) => {
      if (part.type === "resistor") part.subtitle = resistorOhms + " Ω · ограничивает ток";
      if (part.type === "battery") part.title = "Батарейка " + batteryVoltage + " В";
      const card = document.createElement("article");
      card.className = "board-component" + (part.type === "led" && part.lit ? " is-lit" : "") + (part.type === "switch" && part.closed ? " switch-closed" : "");
      card.dataset.part = part.id;

      const title = document.createElement("span");
      title.className = "component-title";
      title.textContent = part.title;
      card.appendChild(title);

      const subtitle = document.createElement("span");
      subtitle.className = "component-subtitle";
      subtitle.textContent = part.type === "switch" ? (part.closed ? "Замкнут · проводит ток" : "Разомкнут · ток не идёт") : part.subtitle;
      card.appendChild(subtitle);

      const glyph = document.createElement("div");
      glyph.className = "component-glyph";
      const glyphInner = document.createElement("span");
      glyphInner.className = part.type === "resistor" ? "glyph-resistor" : part.type === "led" ? "glyph-led" : part.type === "switch" ? "glyph-switch" : "glyph-resistor";
      glyph.appendChild(glyphInner);
      card.appendChild(glyph);

      const terminals = document.createElement("div");
      terminals.className = "terminals";
      part.terminals.forEach((terminal) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "terminal" + (terminal.positive ? " positive" : "") + (selectedTerminal === terminalKey(part.id, terminal.id) ? " selected" : "");
        button.textContent = terminal.label;
        button.title = part.title + " — контакт " + terminal.label;
        button.setAttribute("aria-label", button.title);
        button.dataset.part = part.id;
        button.dataset.terminal = terminal.id;
        button.addEventListener("click", () => onTerminalClick(part.id, terminal.id));
        terminals.appendChild(button);
      });
      card.appendChild(terminals);

      if (part.type === "switch") {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "component-remove";
        toggle.textContent = part.closed ? "●" : "○";
        toggle.title = part.closed ? "Разомкнуть выключатель" : "Замкнуть выключатель";
        toggle.setAttribute("aria-label", toggle.title);
        toggle.addEventListener("click", () => {
          part.closed = !part.closed;
          part.lit = false;
          saveCircuit();
          render();
          showResult("", part.closed ? "Выключатель замкнут" : "Выключатель разомкнут", part.closed ? "Теперь контакты выключателя могут проводить ток." : "Цепь через выключатель разорвана.");
        });
        card.appendChild(toggle);
      } else if (part.type !== "battery") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "component-remove";
        remove.textContent = "×";
        remove.title = "Удалить компонент";
        remove.setAttribute("aria-label", "Удалить " + part.title);
        remove.addEventListener("click", () => removePart(part.id));
        card.appendChild(remove);
      }
      grid.appendChild(card);
    });
    $("partCount").textContent = countText(parts.length);
    const batteryTitle = $("batteryTitle");
    if (batteryTitle) batteryTitle.textContent = "Батарейка " + batteryVoltage + " В";
    const voltageControl = $("batteryVoltageControl");
    const resistorControl = $("resistorValueControl");
    if (voltageControl) voltageControl.value = String(batteryVoltage);
    if (resistorControl) resistorControl.value = String(resistorOhms);
    requestAnimationFrame(drawWires);
  }

  function onTerminalClick(partId, terminalId) {
    const key = terminalKey(partId, terminalId);
    if (!selectedTerminal) {
      selectedTerminal = key;
      hint.textContent = "Теперь нажми на второй контакт, чтобы протянуть провод.";
      render();
      return;
    }
    if (selectedTerminal === key) {
      selectedTerminal = null;
      hint.textContent = "Выбор отменён. Нажми на контакт, с которого начнётся провод.";
      render();
      return;
    }
    const [firstPart, firstTerminal] = selectedTerminal.split(":");
    if (firstPart === partId) {
      selectedTerminal = key;
      hint.textContent = "Выбери контакт другой детали.";
      render();
      return;
    }
    const duplicate = wires.some((wire) =>
      (wire.a === selectedTerminal && wire.b === key) || (wire.a === key && wire.b === selectedTerminal)
    );
    if (duplicate) {
      selectedTerminal = null;
      hint.textContent = "Эти контакты уже соединены. Выбери другую пару.";
      render();
      return;
    }
    currentFlow = false;
    wires.push({ a: selectedTerminal, b: key });
    selectedTerminal = null;
    saveCircuit();
    hint.textContent = "Провод добавлен. Можно соединять следующие контакты или запустить симуляцию.";
    render();
    showResult("", "Провод подключён", "Проверь схему: каждый контакт должен вести к нужной части цепи.");
  }

  function removePart(id) {
    currentFlow = false;
    parts = parts.filter((part) => part.id !== id);
    wires = wires.filter((wire) => !wire.a.startsWith(id + ":") && !wire.b.startsWith(id + ":"));
    selectedTerminal = null;
    saveCircuit();
    render();
    showResult("", "Компонент удалён", "Провода, подключённые к этой детали, тоже удалены.");
  }

  function terminalElement(key) {
    const [partId, terminalId] = key.split(":");
    return board.querySelector('[data-part="' + CSS.escape(partId) + '"][data-terminal="' + CSS.escape(terminalId) + '"]');
  }

  function drawWires() {
    const rect = board.getBoundingClientRect();
    wireLayer.setAttribute("viewBox", "0 0 " + rect.width + " " + rect.height);
    wireLayer.innerHTML = "";
    wires.forEach((wire) => {
      const a = terminalElement(wire.a);
      const b = terminalElement(wire.b);
      if (!a || !b) return;
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const x1 = ar.left + ar.width / 2 - rect.left;
      const y1 = ar.top + ar.height / 2 - rect.top;
      const x2 = br.left + br.width / 2 - rect.left;
      const y2 = br.top + br.height / 2 - rect.top;
      const midY = Math.max(12, Math.min(rect.height - 12, (y1 + y2) / 2 - 12));
      const wireD = "M " + x1 + " " + y1 + " C " + x1 + " " + midY + ", " + x2 + " " + midY + ", " + x2 + " " + y2;
      const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hitPath.setAttribute("d", wireD);
      hitPath.setAttribute("class", "wire-hit");
      hitPath.setAttribute("tabindex", "0");
      hitPath.setAttribute("role", "button");
      hitPath.setAttribute("aria-label", "Удалить провод");
      hitPath.setAttribute("title", "Нажми, чтобы удалить этот провод");
      hitPath.addEventListener("click", (event) => {
        event.stopPropagation();
        wires = wires.filter((item) => item !== wire);
        selectedTerminal = null;
        parts.forEach((part) => { part.lit = false; });
        saveCircuit();
        render();
        showResult("", "Провод удалён", "Соедини эти контакты снова, если он нужен для схемы.");
      });
      hitPath.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          hitPath.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
      });
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", wireD);
      path.setAttribute("class", "wire-path" + (wires.indexOf(wire) % 2 ? " wire-blue" : "") + (currentFlow ? " wire-current" : ""));
      wireLayer.append(hitPath, path);
    });
  }

  function buildGraph(ignoreLedDirection) {
    const graph = new Map();
    function addNode(node) { if (!graph.has(node)) graph.set(node, []); }
    function addEdge(from, to, component, direction) {
      addNode(from); addNode(to);
      graph.get(from).push({ to, component, direction });
      if (direction !== "forward") graph.get(to).push({ to: from, component, direction: "reverse" });
    }
    wires.forEach((wire) => addEdge(wire.a, wire.b, null, "both"));
    parts.forEach((part) => {
      if (part.type === "battery") return;
      if (part.type === "switch" && !part.closed) return;
      const a = terminalKey(part.id, part.terminals[0].id);
      const b = terminalKey(part.id, part.terminals[1].id);
      if (part.type === "led" && !ignoreLedDirection) addEdge(a, b, part, "forward");
      else if (part.type === "led") addEdge(a, b, part, "both");
      else addEdge(a, b, part, "both");
    });
    return graph;
  }

  function findPoweredPath(ignoreLedDirection) {
    const graph = buildGraph(Boolean(ignoreLedDirection));
    const start = "battery:plus";
    const finish = "battery:minus";
    const queue = [{ node: start, path: [], visited: new Set([start]) }];
    while (queue.length) {
      const current = queue.shift();
      if (current.node === finish) return current.path;
      (graph.get(current.node) || []).forEach((edge) => {
        if (current.visited.has(edge.to)) return;
        const visited = new Set(current.visited);
        visited.add(edge.to);
        queue.push({ node: edge.to, path: edge.component ? current.path.concat(edge.component) : current.path, visited });
      });
    }
    return null;
  }

  function simulate() {
    currentFlow = false;
    parts.forEach((part) => { part.lit = false; });
    const ledParts = parts.filter((part) => part.type === "led");
    const resistorParts = parts.filter((part) => part.type === "resistor");
    if (!ledParts.length || !resistorParts.length) {
      render();
      showResult("warning", "Не хватает компонентов", "Для первого опыта добавь хотя бы один резистор и один светодиод.");
      return;
    }
    const path = findPoweredPath(false);
    if (!path) {
      const reversePolarityPath = findPoweredPath(true);
      const hasLedAndResistor = reversePolarityPath && reversePolarityPath.some((part) => part.type === "led") && reversePolarityPath.some((part) => part.type === "resistor");
      render();
      if (hasLedAndResistor) {
        showResult("error", "Проверь полярность светодиода", "Путь цепи собран, но ток пытается пройти через светодиод в обратном направлении. Поменяй местами провода на контактах A и K.");
      } else {
        showResult("warning", "Цепь пока разомкнута", "Проверь провода: нужен непрерывный путь от + батарейки через резистор и светодиод к −. Замкни выключатель, если используешь его.");
      }
      return;
    }
    const pathLed = path.find((part) => part.type === "led");
    const pathResistor = path.find((part) => part.type === "resistor");
    if (!pathLed) {
      render();
      showResult("warning", "Светодиод не включён в цепь", "Путь тока замкнут, но он должен проходить через светодиод.");
      return;
    }
    if (!pathResistor) {
      render();
      showResult("error", "Нет ограничения тока", "Не подключай светодиод напрямую к батарейке. Добавь резистор последовательно — он ограничивает ток и защищает светодиод.");
      return;
    }
    const seriesResistors = Math.max(1, path.filter((part) => part.type === "resistor").length);
    const currentMA = Math.max(0, (batteryVoltage - 2) / (resistorOhms * seriesResistors) * 1000);
    const estimatedCurrent = currentMA.toFixed(1).replace(".", ",");
    if (currentMA <= 0) {
      render();
      showResult("warning", "Не хватает напряжения", "В модели светодиоду нужно около 2 В. Увеличь напряжение источника, чтобы увидеть ток.");
      return;
    }
    if (currentMA > 20) {
      render();
      showResult("error", "Слишком большой ток", "Расчётный ток — " + estimatedCurrent + " мА. Для учебной модели это выше условного предела 20 мА. Увеличь сопротивление или уменьши напряжение, иначе реальный светодиод может перегреться.");
      return;
    }
    pathLed.lit = true;
    currentFlow = true;
    render();
    if (!solved) {
      solved = true;
      if (window.GLITCH_LAB && typeof window.GLITCH_LAB.awardXP === "function") {
        window.GLITCH_LAB.completeLesson("circuit", "first-led-circuit");
      }
    }
    showResult("success", "Светодиод загорелся!", "При источнике " + batteryVoltage + " В, падении на светодиоде около 2 В и " + seriesResistors + " резисторе(ах) по " + resistorOhms + " Ω расчётный ток — " + estimatedCurrent + " мА. Цепь замкнута, полярность верная, ток в безопасном диапазоне модели.");
  }

  function showResult(kind, title, description) {
    resultBox.className = "simulation-result" + (kind ? " " + kind : "");
    resultBox.innerHTML = "";
    const icon = document.createElement("span");
    icon.className = "result-icon";
    icon.textContent = kind === "success" ? "✓" : kind === "error" ? "!" : kind === "warning" ? "!" : "i";
    const body = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = title;
    const text = document.createElement("p");
    text.textContent = description;
    body.append(heading, text);
    resultBox.append(icon, body);
  }

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => addPart(button.dataset.add));
  });
  $("simulateButton").addEventListener("click", simulate);
  $("batteryVoltageControl").addEventListener("change", (event) => {
    batteryVoltage = Number(event.target.value);
    saveCircuit();
    render();
    showResult("", "Напряжение изменено", "Источник теперь выдаёт " + batteryVoltage + " В. Запусти симуляцию, чтобы пересчитать ток.");
  });
  $("resistorValueControl").addEventListener("change", (event) => {
    resistorOhms = Number(event.target.value);
    saveCircuit();
    render();
    showResult("", "Сопротивление изменено", "Каждый резистор теперь имеет номинал " + resistorOhms + " Ω. Чем выше сопротивление, тем меньше ток при том же напряжении.");
  });
  $("clearWiresButton").addEventListener("click", () => {
    currentFlow = false;
    wires = [];
    selectedTerminal = null;
    saveCircuit();
    hint.textContent = "Все провода убраны. Начни соединять контакты заново.";
    parts.forEach((part) => { part.lit = false; });
    render();
    showResult("", "Провода убраны", "Компоненты остались на плате. Соедини их заново.");
  });
  $("resetButton").addEventListener("click", () => {
    currentFlow = false;
    batteryVoltage = 5;
    resistorOhms = 220;
    parts = [{ id: "battery", type: "battery", title: "Батарейка 5 В", subtitle: "Источник постоянного напряжения", terminals: [{ id: "plus", label: "+", positive: true }, { id: "minus", label: "−" }] }];
    nextId = 1;
    wires = [];
    selectedTerminal = null;
    solved = false;
    saveCircuit();
    hint.textContent = "Нажми на контакт детали, затем на второй контакт, чтобы соединить их.";
    render();
    showResult("", "Схема сброшена", "Добавь резистор и светодиод, затем собери свою первую цепь.");
  });

  function loadPreset(reverseLed) {
    currentFlow = false;
    batteryVoltage = 5;
    resistorOhms = 220;
    const resistor = { id: "resistor-1", type: "resistor", title: types.resistor.title, subtitle: types.resistor.subtitle, terminals: types.resistor.terminals.map((terminal) => ({ ...terminal })) };
    const led = { id: "led-2", type: "led", title: types.led.title, subtitle: types.led.subtitle, terminals: types.led.terminals.map((terminal) => ({ ...terminal })) };
    parts = [
      { id: "battery", type: "battery", title: "Батарейка 5 В", subtitle: "Источник постоянного напряжения", terminals: [{ id: "plus", label: "+", positive: true }, { id: "minus", label: "−" }] },
      resistor,
      led
    ];
    nextId = 3;
    const resistorIn = terminalKey(resistor.id, "a");
    const resistorOut = terminalKey(resistor.id, "b");
    const ledAnode = terminalKey(led.id, "a");
    const ledCathode = terminalKey(led.id, "k");
    wires = reverseLed
      ? [
          { a: "battery:plus", b: resistorIn },
          { a: resistorOut, b: ledCathode },
          { a: ledAnode, b: "battery:minus" }
        ]
      : [
          { a: "battery:plus", b: resistorIn },
          { a: resistorOut, b: ledAnode },
          { a: ledCathode, b: "battery:minus" }
        ];
    selectedTerminal = null;
    solved = false;
    saveCircuit();
    render();
    hint.textContent = "Пример собран. Нажми «Запустить симуляцию» и посмотри на результат.";
    showResult("", reverseLed ? "Учебная ошибка установлена" : "Готово к запуску", reverseLed
      ? "Светодиод подключён наоборот. Запусти симуляцию и попробуй найти причину."
      : "Цепь собрана автоматически: батарейка → резистор → светодиод → батарейка. Запусти симуляцию.");
  }

  $("workingPresetButton").addEventListener("click", () => loadPreset(false));
  $("errorPresetButton").addEventListener("click", () => loadPreset(true));

  const wireHelp = $("connectionHint");
  if (wireHelp) wireHelp.textContent = "Нажми на контакт, затем на контакт другой детали. Чтобы удалить провод, нажми на сам провод.";
  window.addEventListener("resize", drawWires);
  window.addEventListener("load", drawWires);
  restoreCircuit();
  render();
})();