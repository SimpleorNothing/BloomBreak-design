(function (root) {
  'use strict';

  const scenes = [
    { id: 'seoul-rooftop', title: ['서울 옥탑방', 'Seoul Rooftop Room'], width: 720, height: 1366, windowLayer: 'closed' },
    { id: 'east-sea-lighthouse', title: ['동해 등대가 보이는 집', 'Korean Seaside Cottage'], width: 720, height: 1560, windowLayer: 'open' },
    { id: 'lakeside-cabin', title: ['호숫가 오두막', 'Lakeside Cabin Porch'], width: 720, height: 1560 }
  ];
  const language = () => /^en/i.test(root.document.documentElement.lang) ? 1 : 0;

  function viewState({ time, weather, temperature, wind = false }) {
    const cold = Number.isFinite(temperature) && temperature < 10;
    const clear = weather === 'clear' || weather === 'wind';
    return { time, weather: weather === 'wind' ? 'clear' : weather, wind: wind || weather === 'wind', windowOpen: time !== 'night' && clear && !cold };
  }

  function imagePath(scene) {
    return 'assets/premium-scene-previews/' + scene.id + '.webp';
  }

  function windowPath(scene) {
    return scene.windowLayer ? 'assets/premium-scene-previews/' + scene.id + '-' + scene.windowLayer + '.webp' : undefined;
  }

  function mount(host, options = {}) {
    const doc = host.ownerDocument;
    const lang = language();
    const t = (ko, en) => lang ? en : ko;
    const resolve = path => new URL(path, options.base || doc.baseURI).href;
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
    plate.src = resolve(imagePath(scene));
    artwork.append(plate);
    function layer(parent, name, tag = 'div') {
      const element = doc.createElement(tag);
      element.className = 'bbPremium' + name;
      element.setAttribute('aria-hidden', 'true');
      if (tag === 'img') element.alt = '';
      parent.append(element);
      return element;
    }
    const treeMask = layer(artwork, 'TreeMask');
    layer(treeMask, 'SwayingTrees', 'img').src = plate.src;
    const windowLayer = scene.windowLayer ? layer(artwork, 'WindowLayer', 'img') : null;
    if (windowLayer) windowLayer.src = resolve(windowPath(scene));
    stage.append(artwork);
    layer(stage, 'WeatherShade');
    layer(stage, 'CloudMask');
    layer(stage, 'WetSurface');
    layer(stage, 'Precipitation');
    if (scene.id !== 'seoul-rooftop') layer(stage, 'WindWater');

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
      if (windowLayer) {
        windowLayer.hidden = selected.windowOpen !== (scene.windowLayer === 'open');
        const message = selected.windowOpen ? t('창문 열림', 'Window open') : t('창문 닫힘', 'Window closed');
        if (status.textContent !== message) status.textContent = message;
      }
    }

    controls.addEventListener('change', draw);
    draw();
    const timer = root.setInterval(draw, 30000);
    return () => root.clearInterval(timer);
  }

  root.BloomBreakPremiumScenePreviews = { scenes, mount };
})(window);
