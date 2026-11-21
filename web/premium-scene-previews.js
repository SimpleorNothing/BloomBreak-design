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
    'lakeside-cabin': {
      day: [0, 87, 447, 532, 619, 778, 1024],
      sunset: [0, 85, 438, 520, 608, 772, 1024],
      night: [0, 90, 432, 508, 598, 756, 1024],
      offset: { sunset: [0, 0, 0, 0, 1, 0, 0], night: [0, 0, 0, -2, -3, 0, 0] }
    }
  };
  const water = {
    'east-sea-lighthouse': { first: .407, last: .619, bands: 11, swell: true },
    'lakeside-cabin': { first: .442, last: .618, bands: 17, swell: false }
  };

  const fixedViews = {
    'seoul-rooftop': {
      outside: [[.104,.073],[.922,.099],[.922,.626],[.087,.626],[.101,.511]],
      sky: [[.106,.074],[.921,.099],[.92,.311],[.85,.31],[.79,.314],[.698,.313],[.695,.264],[.681,.264],[.679,.314],[.6,.319],[.51,.331],[.41,.343],[.26,.341],[.18,.323],[.106,.309]],
      lights: [[.143,.353],[.167,.354],[.191,.363],[.214,.366],[.257,.363],[.371,.394],[.462,.396],[.507,.421],[.572,.425],[.624,.412],[.736,.421],[.80,.423],[.845,.396]]
    },
    'east-sea-lighthouse': {
      outside: [[.149,.131],[.899,.12],[.891,.618],[.149,.618]],
      sky: [[.15,.132],[.898,.121],[.896,.355],[.839,.364],[.791,.377],[.788,.348],[.768,.348],[.765,.387],[.708,.389],[.615,.398],[.5,.405],[.15,.405]],
      lights: [[.779,.354]]
    }
  };

  function clipRegion(context, polygon, width, height) {
    context.beginPath();
    for (const [index, [x, y]] of polygon.entries()) {
      if (index === 0) context.moveTo(x * width, y * height);
      else context.lineTo(x * width, y * height);
    }
    context.closePath();
    context.clip();
  }

  function paintFixedView(daylight, skyImage, context, scene, time) {
    const { width, height } = scene;
    const profile = fixedViews[scene.id];
    const night = time === 'night';
    context.drawImage(daylight, 0, 0, width, height);
    if (time === 'day') return;
    context.save();
    // Lighting and sky are composites made over the daytime photograph. The
    // architecture, foreground and outdoor objects are never replaced or moved.
    context.globalCompositeOperation = 'soft-light';
    context.fillStyle = night ? 'rgba(241,151,71,.43)' : 'rgba(255,141,84,.25)';
    context.fillRect(0, 0, width, height);
    context.restore();

    context.save();
    clipRegion(context, profile.outside, width, height);
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = night ? '#27394d' : '#daa797';
    context.fillRect(0, 0, width, height);
    context.restore();

    context.save();
    clipRegion(context, profile.sky, width, height);
    const sw = skyImage.naturalWidth, sh = skyImage.naturalHeight;
    context.drawImage(skyImage, sw * .21, sh * .145, sw * .62, sh * .154,
      width * .086, height * .062, width * .85, height * .346);
    context.restore();

    if (night) {
      for (const [x, y] of profile.lights) {
        const size = scene.id === 'east-sea-lighthouse' ? 7 : 3.5;
        const glow = context.createRadialGradient(x * width, y * height, 0, x * width, y * height, size);
        glow.addColorStop(0, 'rgba(255,218,152,.97)');
        glow.addColorStop(.3, 'rgba(255,194,118,.77)');
        glow.addColorStop(1, 'rgba(255,184,99,0)');
        context.fillStyle = glow;
        context.fillRect(x * width - size, y * height - size, 2 * size, 2 * size);
      }
    }
  }

  function sourcePosition(sceneId, time, y) {
    const profile = framing[sceneId];
    if (!profile) return { x: 0, y };
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

  function registerArtwork(image, context, scene, time) {
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
    const travel = profile.swell ? .27 : .12;
    const location = ((index / profile.bands + seconds * travel) % 1 + 1) % 1;
    const depth = location ** 1.6;
    const y = profile.first + (profile.last - profile.first) * depth;
    const fade = Math.sin(Math.PI * location);
    const height = (profile.swell ? .024 : .0045) * (.2 + depth * .8);
    return { y, depth, fade, height, phase: index * 1.9 + seconds * 1.4 };
  }

  function paintWater(context, surface, sceneId, seconds, time, roughSea) {
    const profile = water[sceneId];
    const { width, height } = surface;
    context.clearRect(0, 0, width, height);
    const low = Math.floor(profile.first * height), high = Math.ceil(profile.last * height);
    const night = time === 'night';
    const naturalRoughWater = profile.swell && roughSea?.complete && roughSea.naturalWidth;
    const surfLighting = night ? 'brightness(.63) saturate(.72)'
      : time === 'sunset' ? 'sepia(.2) brightness(.85) saturate(.86)' : 'none';
    for (let y = low; y < high; y += 3) {
      const depth = (y - low) / (high - low);
      const shift = Math.sin(depth * (profile.swell ? 22 : 50) - seconds * 3.4) * depth * (profile.swell ? 8 : 3);
      context.drawImage(surface, 0, y, width, 3, naturalRoughWater ? 0 : shift, y, width, 3);
      if (!naturalRoughWater) continue;
      const roll = Math.sin(y * .094 - seconds * 4.6) * Math.min(8, 2 + depth * 8);
      context.filter = surfLighting;
      context.globalAlpha = Math.min(1, depth * 8);
      context.drawImage(roughSea, 0, y + roll, width, 3, shift * 1.2, y, width, 3);
      context.globalAlpha = 1;
      context.filter = 'none';
    }
    for (let i = 0; i < profile.bands; i++) {
      const band = waterBand(profile, i, seconds);
      const y = band.y * height;
      const size = band.height * height;
      const brightness = (night ? .79 : 1) * (naturalRoughWater ? .5 : 1);
      const stroke = context.createLinearGradient(0, y - size, 0, y + size);
      stroke.addColorStop(0, 'transparent');
      stroke.addColorStop(.41, 'rgba(10,40,59,' + (band.fade * .43 * brightness) + ')');
      stroke.addColorStop(.52, 'rgba(210,238,250,' + (band.fade * .74 * brightness) + ')');
      stroke.addColorStop(1, 'transparent');
      function crestAt(x) {
        const phase = x / width * (profile.swell ? 7 : 23) + band.phase;
        return y + (Math.sin(phase) * .55 + Math.sin(phase * 2.2) * .24) * size;
      }
      context.beginPath();
      context.moveTo(0, crestAt(0));
      for (let x = 7; x <= width; x += 7) context.lineTo(x, crestAt(x));
      context.strokeStyle = stroke;
      context.lineWidth = Math.max(1.3, size * (profile.swell ? 1.5 : .92));
      context.stroke();
      if (!profile.swell || band.depth < .19) continue;
      // Broken white crests travel with the wave. No foam is painted on the lake.
      context.beginPath();
      for (let x = 0; x < width; x += 9) {
        if (Math.sin(x * .057 + band.phase * 1.8) < -.12) continue;
        const crest = crestAt(x);
        context.moveTo(x, crest);
        context.quadraticCurveTo(x + 5, crest - 2, x + 12, crestAt(x + 12));
      }
      context.lineWidth = 1.8 + band.depth * 3.5;
      context.strokeStyle = 'rgba(234,249,255,' + (band.fade * brightness * .94) + ')';
      context.stroke();
    }
  }

  const imageRevision = '?v=day-framing-wind-3';
  const surfPhoto = 'assets/premium-scene-previews/east-sea-lighthouse-wind-surf.webp';
  const surfLoop = 'assets/premium-scene-previews/east-sea-lighthouse-surf-loop.webp';
  const language = () => /^en/i.test(root.document.documentElement.lang) ? 1 : 0;

  function viewState({ time, weather, temperature, wind = false }) {
    const cold = Number.isFinite(temperature) && temperature < 10;
    return { time, weather, wind, windowOpen: time !== 'night' && weather === 'clear' && !cold };
  }

  function imagePath(scene, time = 'day', weather = 'clear') {
    const plateWeather = weather === 'rain' || weather === 'snow' ? weather : 'clear';
    return 'assets/premium-scene-previews/' + scene.id + '-' + time + '-' + plateWeather + '.webp';
  }

  function windowPath(scene, time = 'day') {
    if (!scene.windowLayer || time === 'night') return undefined;
    return 'assets/premium-scene-previews/' + scene.id + '-day-left-open.webp';
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
    const usesDayGeometry = Boolean(fixedViews[scene.id]);
    const daylight = usesDayGeometry ? doc.createElement('img') : null;
    const roughSea = scene.id === 'east-sea-lighthouse' ? doc.createElement('img') : null;
    const waterCanvas = water[scene.id] ? makeCanvas(artwork, 'WindWater') : null;
    const waterContext = waterCanvas?.getContext?.('2d');
    const surfMask = roughSea ? layer(artwork, 'SurfMask') : null;
    const animatedSurf = surfMask ? layer(surfMask, 'SurfLoop', 'img') : null;
    if (surfMask) surfMask.hidden = true;
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
    const weather = select(t('날씨', 'Weather'), [['current', t('현재 설정', 'Current')], ['clear', t('맑음', 'Clear')], ['rain', t('비', 'Rain')], ['snow', t('눈', 'Snow')]]);
    const wind = select(t('바람', 'Wind'), [['current', t('현재 설정', 'Current')], ['off', t('꺼짐', 'Off')], ['on', t('켜짐', 'On')]]);
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
    let shownDaylight;
    let shownWindow;
    let registered = false;
    let waterFrame = 0;
    let lastFrame = -Infinity;
    let waterPhase = 0;
    let surfRequested = false;
    let surfFailed = false;
    const motion = root.matchMedia?.('(prefers-reduced-motion: reduce)');
    const playWater = () => wind.value === 'on' || !motion?.matches;
    function stopWater() {
      if (waterFrame) root.cancelAnimationFrame(waterFrame);
      waterFrame = 0;
      lastFrame = -Infinity;
    }
    function animateWater(now) {
      waterFrame = 0;
      if (stage.dataset.wind !== 'true' || !registered || !playWater() || doc.hidden) return;
      if (now - lastFrame > 30) {
        if (Number.isFinite(lastFrame)) waterPhase += (now - lastFrame) / 1000;
        paintWater(waterContext, normalized, scene.id, waterPhase, stage.dataset.time, roughSea);
        lastFrame = now;
      }
      waterFrame = root.requestAnimationFrame(animateWater);
    }
    function updateWater(refresh = false) {
      const windy = stage.dataset.wind === 'true' && registered;
      const showMotion = windy && playWater();
      if (animatedSurf) {
        if (showMotion && !surfRequested && !surfFailed) {
          surfRequested = true;
          animatedSurf.src = resolve(surfLoop);
        } else if (!showMotion && surfRequested) {
          surfRequested = false;
          surfFailed = false;
          animatedSurf.removeAttribute('src');
        }
        const playing = showMotion && surfRequested && !surfFailed &&
          animatedSurf.complete && animatedSurf.naturalWidth > 0;
        surfMask.hidden = !playing;
        // The image decoder keeps the surf moving without page animation frames.
        if (waterCanvas) waterCanvas.hidden = playing;
        if (playing) {
          stopWater();
          return;
        }
      }
      if (!waterContext) return;
      if (!windy) {
        stopWater();
        waterPhase = 0;
        waterContext.clearRect(0, 0, waterCanvas.width, waterCanvas.height);
        return;
      }
      // The swell is part of the windy scene even before the browser runs an
      // animation frame and when the user's motion preference pauses playback.
      if (refresh || !waterFrame) {
        paintWater(waterContext, normalized, scene.id, waterPhase, stage.dataset.time, roughSea);
      }
      if (!showMotion || doc.hidden) stopWater();
      else if (!waterFrame) {
        waterFrame = root.requestAnimationFrame(animateWater);
      }
    }
    function readyPlate() {
      const time = stage.dataset.time;
      if (!plateContext || !plate.complete || !plate.naturalWidth) return;
      if (usesDayGeometry && time !== 'day') {
        if (!daylight.complete || !daylight.naturalWidth) return;
        paintFixedView(daylight, plate, plateContext, scene, time);
        registered = true;
      } else {
        registered = registerArtwork(plate, plateContext, scene, time);
      }
      if (registered && treeContext) treeContext.drawImage(normalized, 0, 0);
      normalized.hidden = !registered;
      updateWater(true);
    }
    normalized.hidden = true;
    plate.addEventListener('load', readyPlate);
    daylight?.addEventListener('load', readyPlate);
    plate.addEventListener('error', () => {
      registered = false;
      normalized.hidden = true;
      updateWater();
    });
    const refreshWater = () => updateWater(true);
    const useStaticSurf = () => {
      if (!surfRequested) return;
      surfFailed = true;
      refreshWater();
    };
    animatedSurf?.addEventListener('load', refreshWater);
    animatedSurf?.addEventListener('error', useStaticSurf);
    if (roughSea) {
      roughSea.addEventListener('load', refreshWater);
      roughSea.src = resolve(surfPhoto);
    }
    motion?.addEventListener?.('change', refreshWater);
    doc.addEventListener('visibilitychange', refreshWater);
    function draw() {
      const current = getEnvironment();
      const selected = viewState({
        time: time.value,
        weather: weather.value === 'current' ? current.weather : weather.value,
        wind: wind.value === 'current' ? Boolean(current.wind) : wind.value === 'on',
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
      if (daylight && selected.time !== 'day') {
        const nextDaylight = resolve(imagePath(scene, 'day', selected.weather));
        if (shownDaylight !== nextDaylight) {
          shownDaylight = nextDaylight;
          daylight.src = nextDaylight;
        }
      }
      if (!registered) readyPlate();
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
      animatedSurf?.removeEventListener('load', refreshWater);
      animatedSurf?.removeEventListener('error', useStaticSurf);
      if (surfRequested) animatedSurf.removeAttribute('src');
      roughSea?.removeEventListener('load', refreshWater);
      motion?.removeEventListener?.('change', refreshWater);
      doc.removeEventListener('visibilitychange', refreshWater);
    };
  }

  const api = { scenes, viewState, imagePath, windowPath, sourcePosition, waterBand, mount };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BloomBreakPremiumScenePreviews = api;
})(typeof window === 'undefined' ? globalThis : window);
