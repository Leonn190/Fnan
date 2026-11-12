(() => {
'use strict';
const { CAMERAS, VENUE, TRACKING_POINTS } = window.NathGame;

const SVG_NS = 'http://www.w3.org/2000/svg';
const SCALE = 10.5;
const PAD_X = 18;
const PAD_Y = 18;
const X = value => PAD_X + value * SCALE;
const Y = value => PAD_Y + (VENUE.height - value) * SCALE;

function makeSvg(tag, attrs = {}, content = null) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  if (content !== null) element.textContent = content;
  return element;
}

function bindMapButton(node, activate) {
  node.addEventListener('click', activate);
  node.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!event.repeat) activate();
  });
}

function setGateClosed(gate, closed) {
  gate.classList.toggle('closed', closed);
  gate.setAttribute('aria-pressed', String(closed));
}

function makeCameraMap({ canvas, onSelect, canToggleGate, maxClosedGates, onGatesChange = () => {} }) {
  const svg = makeSvg('svg', {
    viewBox: '0 0 380 332',
    role: 'group',
    'aria-label': 'Planta do restaurante: 12 câmeras e portões interativos',
  });

  const polygons = new Map();
  for (const room of VENUE.rooms) {
    const points = room.points.map(([x,y]) => `${X(x)},${Y(y)}`).join(' ');
    const polygon = makeSvg('polygon',{points,class:'map-room','data-room':room.id});
    svg.append(polygon);
    polygons.set(room.id,polygon);
  }

  for (const obj of VENUE.objects) {
    if (obj.id !== 'PALCO') continue;
    const [x0,y0,x1,y1] = obj.bounds;
    svg.append(makeSvg('rect',{x:X(x0),y:Y(y1),width:(x1-x0)*SCALE,height:(y1-y0)*SCALE,class:'map-stage'}));
  }

  const gateLayer = makeSvg('g', { role: 'group', 'aria-label': 'Portões' });
  const gateNodes = new Map();
  const closedGates = new Set();

  function toggleGate(id) {
    const gate = gateNodes.get(id);
    if (!gate) return;
    const closed = !closedGates.has(id);
    const changes = [];
    if (closed) {
      if (maxClosedGates <= 0) return;
      if (closedGates.size === maxClosedGates) {
        const reopened = Array.from(closedGates).at(-1);
        closedGates.delete(reopened);
        setGateClosed(gateNodes.get(reopened), false);
        changes.push({ id: reopened, closed: false });
      }
      closedGates.add(id);
    } else {
      closedGates.delete(id);
    }
    setGateClosed(gate, closed);
    changes.push({ id, closed });
    onGatesChange(changes);
  }

  for (const {id,axis,at,start,end,type} of VENUE.openings) {
    const horizontal = axis === 'H';
    const coords = {
      x1: X(horizontal ? start : at),
      y1: Y(horizontal ? at : start),
      x2: X(horizontal ? end : at),
      y2: Y(horizontal ? at : end),
    };
    if (type === 'portao') {
      const label = `Portão ${id}`;
      const gate = makeSvg('g', {
        class: 'map-gate', 'data-gate': id, tabindex: '0', role: 'button',
        'aria-label': label, 'aria-pressed': 'false',
      });
      gate.append(makeSvg('title', {}, label));
      gate.append(makeSvg('line', {...coords, class: 'gate-hit-area'}));
      gate.append(makeSvg('line', {...coords, class: 'gate-line'}));
      bindMapButton(gate, () => { if (canToggleGate()) toggleGate(id); });
      gateNodes.set(id, gate);
      gateLayer.append(gate);
      continue;
    }
    svg.append(makeSvg('line', {
      ...coords,
      class:`map-opening ${type==='saida'?'exit':'passage'}`,
      'stroke-dasharray': type==='livre'?'3 2':'none',
    }));
  }

  const trackingLayer = makeSvg('g', { class: 'map-tracking', 'aria-hidden': 'true' });

  const cameraNodes = new Map();
  for (const cam of CAMERAS) {
    const px = X(cam.x), py = Y(cam.y);
    const g = makeSvg('g', {
      class:`map-camera ${cam.renderAvailable?'has-render':'no-render'}`,
      'data-cam':cam.id,
      tabindex:'0',
      role:'button',
      'aria-label':`${cam.id}${cam.renderAvailable?'':' (somente planta técnica)'}`,
    });
    const length = 20;
    const rads = cam.angle * Math.PI / 180;
    g.append(makeSvg('path',{
      d:`M ${px} ${py} L ${px+Math.sin(rads)*length} ${py-Math.cos(rads)*length}`,
      stroke:'#a8e5f1','stroke-width':'1.6','stroke-dasharray':'2 3',fill:'none',opacity:'.6',
    }));
    g.append(makeSvg('circle',{cx:px,cy:py,r:16,class:'pin-area'}));
    g.append(makeSvg('circle',{cx:px,cy:py,r:13,class:'pin-halo'}));
    g.append(makeSvg('circle',{cx:px,cy:py,r:10.7,class:'pin-body'}));
    g.append(makeSvg('text',{x:px,y:py+3.5,class:'pin-number'},String(cam.number).padStart(2,'0')));
    bindMapButton(g, () => onSelect(cam.id));
    const tip = makeSvg('title',{},cam.id);
    g.append(tip);
    svg.append(g);
    cameraNodes.set(cam.id,g);
  }

  // The gate targets sit above camera halos where their coordinates are close.
  svg.append(gateLayer, trackingLayer);
  canvas.append(svg);
  let activeCamera;
  let trackingKey;
  return {
    toggleGate,
    isGateClosed: id => closedGates.has(id),
    openGate(id) {
      if (!closedGates.delete(id)) return;
      setGateClosed(gateNodes.get(id), false);
      onGatesChange([{ id, closed: false }], true);
    },
    closedGateIds: () => Array.from(closedGates),
    resetGates() {
      for (const id of closedGates) setGateClosed(gateNodes.get(id), false);
      closedGates.clear();
    },
    setActive(camera) {
      if (activeCamera === camera) return;
      activeCamera = camera;
      for (const [id,node] of cameraNodes) {
        node.classList.toggle('active',id===camera.id);
        node.setAttribute('aria-pressed',String(id===camera.id));
      }
      for (const [id,polygon] of polygons) polygon.classList.toggle('highlight',id===camera.room);
    },
    setTracking(actors) {
      const key = actors.map(({ id, position }) => `${id}:${position}`).join('|');
      if (key === trackingKey) return;
      trackingKey = key;
      const byPosition = new Map();
      for (const actor of actors) {
        if (!Object.hasOwn(TRACKING_POINTS, actor.position)) continue;
        const list = byPosition.get(actor.position) ?? [];
        list.push(actor);
        byPosition.set(actor.position, list);
      }

      const markers = [];
      for (const [position, occupants] of byPosition) {
        const [x, y] = TRACKING_POINTS[position];
        occupants.forEach(({ id, name, color }, index) => {
          const offset = (index - (occupants.length - 1) / 2) * 11;
          const dot = makeSvg('circle', {
            cx: X(x) + offset, cy: Y(y), r: 4.3, class: 'animatronic-marker',
            'data-position': position, 'data-actor': id, fill: color,
          });
          dot.append(makeSvg('title', {}, name));
          markers.push(dot);
        });
      }
      trackingLayer.replaceChildren(...markers);
    },
  };
}

window.NathGame.makeCameraMap = makeCameraMap;

})();
