(function (root) {
  'use strict';

  const scenes = [
    { id: 'seoul-rooftop', title: ['서울 옥탑방', 'Seoul Rooftop Room'], width: 510, height: 1024, windowLayer: 'open' },
    { id: 'east-sea-lighthouse', title: ['동해 등대가 보이는 집', 'Korean Seaside Cottage'], width: 510, height: 1024, windowLayer: 'open' },
    { id: 'lakeside-cabin', title: ['호숫가 오두막', 'Lakeside Cabin Porch'], width: 510, height: 1024 }
  ];
  // Pixel correspondences against each scene's clear daytime plate: eaves,
  // outdoor landmarks, sill/waterline and the front/back edges of the table.
  const framing = {
    'seoul-rooftop': {
      day: [0, 78, 306, 528, 645, 752, 924, 1024],
      sunset: [0, 75, 301, 518, 624, 723, 884, 1024],
      night: [0, 75, 294, 507, 615, 716, 882, 1024],
      offset: { sunset: [9, 9, 15, 10, 2, 0, 0, 0], night: [4, 4, 11, 7, 2, 0, 0, 0] }
    },
    'east-sea-lighthouse': {
      day: [0, 127, 378, 415, 647, 771, 993, 1024],
      sunset: [0, 123, 369, 405, 626, 755, 993, 1024],
      night: [0, 128, 375, 412, 637, 761, 988, 1024],
      offset: { sunset: [0, 0, -2, 0, 0, 0, 0, 0], night: [-1, -1, -1, 0, 0, 0, 0, 0] }
    },
    'lakeside-cabin': {
      day: [0, 87, 447, 532, 619, 778, 1024],
      sunset: [0, 85, 438, 520, 608, 772, 1024],
      night: [0, 90, 432, 508, 598, 756, 1024],
      offset: { sunset: [0, 0, 0, 0, 1, 0, 0], night: [0, 0, 0, -2, -3, 0, 0] }
    }
  };
  const water = {
    'east-sea-lighthouse': { first: .405, last: .58, bands: 16, swell: true },
    'lakeside-cabin': { first: .442, last: .618, bands: 21, swell: false }
  };

  function sourcePosition(sceneId, time, y) {
    const profile = framing[sceneId];
    const dst = profile.day;
    const src = profile[time];
    let index = 0;
    while (index < dst.length - 2 && y > dst[index + 1]) index++;
    const blend = (y - dst[index]) / (dst[index + 1] - dst[index]);
    const offset = profile.offset[time];
    return {
      y: src[index] + (src[index + 1] - src[index]) * blend,
      x: offset ? offset[index] + (offset[index + 1] - offset[index]) * blend : 0
    };
  }

  function registerArtwork(image, canvas, context, scene, time) {
    if (!context || !image.naturalWidth || !image.naturalHeight) return false;
    const { width, height } = scene;
    const sx = image.naturalWidth / width, sy = image.naturalHeight / height;
    if (time === 'day') {
      context.drawImage(image, 0, 0, width, height);
      return true;
    }
    for (let y = 0; y < height; y += 4) {
      const bottom = Math.min(height, y + 4);
      const top = sourcePosition(scene.id, time, y);
      const end = sourcePosition(scene.id, time, bottom);
      const sh = (end.y - top.y) * sy;
      const shift = Math.round((top.x + end.x) / 2);
      const dx = Math.max(0, -shift);
      const crop = Math.max(0, shift);
      const span = width - Math.abs(shift);
      context.drawImage(image, crop * sx, top.y * sy, span * sx, sh, dx, y, span, bottom - y);
      if (shift > 0) context.drawImage(image, image.naturalWidth - 1, top.y * sy, 1, sh, span, y, shift, bottom - y);
      if (shift < 0) context.drawImage(image, 0, top.y * sy, 1, sh, 0, y, dx, bottom - y);
    }
    return true;
  }

  function waterBand(profile, index, seconds) {
    const travel = profile.swell ? .24 : .16;
    const location = ((index / profile.bands + seconds * travel) % 1 + 1) % 1;
    const depth = location ** 1.7;
    const y = profile.first + (profile.last - profile.first) * depth;
    const fade = Math.sin(Math.PI * location);
    const height = (profile.swell ? .018 : .004) * (.2 + depth * .8);
    return { y, depth, fade, height, phase: index * 1.9 + seconds * 1.1 };
  }

  function paintWater(context, surface, sceneId, seconds, night) {
    const profile = water[sceneId];
    const { width, height } = surface;
    context.clearRect(0, 0, width, height);
    const lo = Math.floor(profile.first * height), hi = Math.ceil(profile.last * height);
    const bright = night ? .58 : 1;
    // Gently bend actual water reflections along each moving horizontal strip.
    for (let y = lo; y < hi; y += 3) {
      const depth = (y - lo) / (hi - lo);
      const shift = Math.sin(depth * (profile.swell ? 24 : 55) - seconds * 3.1) * depth * (profile.swell ? 5 : 2);
      context.drawImage(surface, 0, y, width, 3, shift, y, width, 3);
    }
    for (let i = 0; i < profile.bands; i++) {
      const band = waterBand(profile, i, seconds);
      const y = band.y * height;
      const size = band.height * height;
      const stroke = context.createLinearGradient(0, y - size, 0, y + size * 2);
      stroke.addColorStop(0, 'transparent');
      stroke.addColorStop(.45, 'rgba(15,41,58,' + (band.fade * .24 * bright) + ')');
      stroke.addColorStop(.66, 'rgba(191,220,233,' + (band.fade * .5 * bright) + ')');
      stroke.addColorStop(1, 'transparent');
      context.beginPath();
      for (let x = 0; x <= width; x += 10) {
        const wave = y + Math.sin(x / width * (profile.swell ? 6 : 21) + band.phase) * size;
        if (x === 0) context.moveTo(x, wave);
        else context.lineTo(x, wave);
      }
      context.strokeStyle = stroke;
      context.lineWidth = Math.max(1, size * (profile.swell ? 1.5 : .85));
      context.stroke();
      if (!profile.swell || band.depth < .28) continue;
      // Breaking crests leave short, irregular foam lines only on the sea.
      context.beginPath();
      for (let x = 12; x < width; x += 12) {
        if (Math.sin(x * .087 + band.phase * 1.3) < .22) continue;
        const crest = y + Math.sin(x / width * 6 + band.phase) * size;
        context.moveTo(x, crest);
        context.quadraticCurveTo(x + 4, crest - 1.5, x + 9, crest + .6);
      }
      context.lineWidth = .75 + band.depth;
      context.strokeStyle = 'rgba(232,246,250,' + (band.fade * bright * .67) + ')';
      context.stroke();
    }
  }

  const imageRevision = '?v=roof-flowerbed-1';
  const language = () => /^en/i.test(root.document.documentElement.lang) ? 1 : 0;

  function viewState({ time, weather, temperature, wind = false }) {
    const cold = Number.isFinite(temperature) && temperature < 10;
    const clear = weather === 'clear' || weather === 'wind';
    return { time, weather: weather === 'wind' ? 'clear' : weather, wind: wind || weather === 'wind', windowOpen: time !== 'night' && clear && !cold };
  }

  function imagePath(scene, time = 'day', weather = 'clear') {
    const plateWeather = weather === 'rain' || weather === 'snow' ? weather : 'clear';
    return 'assets/premium-scene-previews/' + scene.id + '-' + time + '-' + plateWeather + '.webp';
  }

  function windowPath(scene, time = 'day') {
    if (!scene.windowLayer || time === 'night') return undefined;
    return 'assets/premium-scene-previews/' + scene.id + '-' + time + '-left-open.webp';
  }

  function mount(host, options = {}) {
    const doc = host.ownerDocument;
    const lang = language();
    const t = (ko, en) => lang ? en : ko;
    const resolve = path => new URL(path + imageRevision, options.base || doc.baseURI).href;
    const getEnvironment = options.getEnvironment || (() => ({ time: 'sunset', weather: 'clear' }));
    const scene = scenes.find(item => item.id === options.sceneId) || scenes[0];
    host.classList.add('bbPremiumPreview');
    const stage = doc.createElement('figure');
    stage.className = 'bbPremiumPreviewStage';
    stage.dataset.scene = scene.id;
    stage.style.aspectRatio = scene.width + ' / ' + scene.height;
    const artwork = doc.createElement('div');
    artwork.className = 'bbPremiumPreviewArtwork';
    const plate = doc.createElement('img');
    plate.alt = scene.title[lang];
    artwork.append(plate);
    function layer(parent, name, tag = 'div') {
      const element = doc.createElement(tag);
      element.className = 'bbPremium' + name;
      element.setAttribute('aria-hidden', 'true');
      if (tag === 'img') element.alt = '';
      parent.append(element);
      return element;
    }
    function makeCanvas(parent, name) {
      const canvas = layer(parent, name, 'canvas');
      canvas.width = scene.width;
      canvas.height = scene.height;
      return canvas;
    }
    const normalized = makeCanvas(artwork, 'RegisteredPlate');
    const plateContext = normalized.getContext?.('2d');
    const waterCanvas = water[scene.id] ? makeCanvas(artwork, 'WindWater') : null;
    const waterContext = waterCanvas?.getContext?.('2d');
    const treeMask = layer(artwork, 'TreeMask');
    const trees = makeCanvas(treeMask, 'SwayingTrees');
    const treeContext = trees.getContext?.('2d');
    const windowLayer = scene.windowLayer ? layer(artwork, 'WindowLayer', 'img') : null;
    if (windowLayer) windowLayer.hidden = true;
    stage.append(artwork);
    layer(stage, 'WeatherShade');
    layer(stage, 'CloudMask');
    layer(stage, 'Precipitation');

    const controls = doc.createElement('div');
    controls.className = 'bbPremiumPreviewControls';
    function select(label, choices) {
      const field = doc.createElement('label');
      field.textContent = label;
      const input = doc.createElement('select');
      for (const [value, name] of choices) {
        const option = doc.createElement('option');
        option.value = value;
        option.textContent = name;
        input.append(option);
      }
      field.append(input);
      controls.append(field);
      return input;
    }
    const time = select(t('시간', 'Time'), [['day', t('낮', 'Day')], ['sunset', t('저녁(노을)', 'Evening (sunset)')], ['night', t('밤', 'Night')]]);
    time.value = getEnvironment().time;
    const weather = select(t('날씨', 'Weather'), [['current', t('현재 설정', 'Current')], ['clear', t('맑음', 'Clear')], ['rain', t('비', 'Rain')], ['snow', t('눈', 'Snow')], ['wind', t('바람', 'Wind')]]);
    const temperature = windowLayer ? select(t('기온', 'Temperature'), [
      ['current', t('LIVE 기온', 'Live temperature')],
      ['18', '18 °C'],
      ['5', '5 °C']
    ]) : null;
    const status = doc.createElement('p');
    status.className = 'bbPremiumPreviewStatus';
    status.setAttribute('role', 'status');
    if (windowLayer) controls.append(status);
    host.replaceChildren(controls, stage);

    let shownPlate;
    let shownWindow;
    let registered = false;
    let waterFrame = 0;
    let lastFrame = -Infinity;
    const motion = root.matchMedia?.('(prefers-reduced-motion: reduce)');
    function stopWater() {
      if (waterFrame) root.cancelAnimationFrame(waterFrame);
      waterFrame = 0;
      lastFrame = -Infinity;
    }
    function animateWater(now) {
      waterFrame = 0;
      if (stage.dataset.wind !== 'true' || !registered || motion?.matches || doc.hidden) return;
      if (now - lastFrame > 30) {
        paintWater(waterContext, normalized, scene.id, now / 1000, stage.dataset.time === 'night');
        lastFrame = now;
      }
      waterFrame = root.requestAnimationFrame(animateWater);
    }
    function updateWater() {
      if (!waterContext) return;
      if (stage.dataset.wind !== 'true' || !registered || motion?.matches || doc.hidden) {
        stopWater();
        waterContext.clearRect(0, 0, waterCanvas.width, waterCanvas.height);
      } else if (!waterFrame) {
        waterFrame = root.requestAnimationFrame(animateWater);
      }
    }
    function readyPlate() {
      registered = registerArtwork(plate, normalized, plateContext, scene, stage.dataset.time);
      if (registered && treeContext) treeContext.drawImage(normalized, 0, 0);
      normalized.hidden = !registered;
      updateWater();
    }
    normalized.hidden = true;
    plate.addEventListener('load', readyPlate);
    plate.addEventListener('error', () => {
      registered = false;
      normalized.hidden = true;
      updateWater();
    });
    motion?.addEventListener?.('change', updateWater);
    doc.addEventListener('visibilitychange', updateWater);
    function draw() {
      const current = getEnvironment();
      const selected = viewState({
        time: time.value,
        weather: weather.value === 'current' ? current.weather : weather.value,
        wind: weather.value === 'current' && current.wind,
        temperature: temperature && temperature.value !== 'current' ? Number(temperature.value) : current.temperature
      });
      stage.dataset.time = selected.time;
      stage.dataset.weather = selected.weather;
      stage.dataset.wind = String(selected.wind);
      const nextPlate = resolve(imagePath(scene, selected.time, selected.weather));
      if (shownPlate !== nextPlate) {
        registered = false;
        shownPlate = nextPlate;
        plate.src = nextPlate;
      }
      updateWater();
      if (windowLayer) {
        const nextWindow = selected.windowOpen && windowPath(scene, selected.time);
        if (nextWindow && shownWindow !== nextWindow) {
          windowLayer.src = resolve(nextWindow);
          shownWindow = nextWindow;
        }
        windowLayer.hidden = !nextWindow;
        const message = selected.windowOpen ? t('창문 열림', 'Window open') : t('창문 닫힘', 'Window closed');
        if (status.textContent !== message) status.textContent = message;
      }
    }

    controls.addEventListener('change', draw);
    draw();
    const timer = root.setInterval(draw, 30000);
    return () => {
      root.clearInterval(timer);
      stopWater();
      motion?.removeEventListener?.('change', updateWater);
      doc.removeEventListener('visibilitychange', updateWater);
    };
  }

  root.BloomBreakPremiumScenePreviews = { scenes, mount };
})(window);
