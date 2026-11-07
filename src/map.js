import { CAMERAS, VENUE } from './data/game-data.js';

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

// Positions inside their corresponding rooms, rather than approximated rectangles.
const LABELS = {
  loja: ['LOJA', 6, 2.8],
  recepcao: ['RECEPÇÃO', 19, 1.4],
  fliperama: ['ARCADE', 30, 5.8],
  estoque: ['ESTOQUE', 2.1, 12],
  controle: ['CONTROLE', 5.65, 6.8],
  vip2: ['VIP 2', 9.2, 12],
  vip1: ['VIP 1', 9.2, 19.3],
  servico: ['SERVIÇO', 2.1, 19],
  cozinha: ['COZINHA', 4.5, 26.2],
  retirada: ['RETIRADA', 14.6, 26.1],
  nathzinha: ['NATH', 21.2, 26.1],
  eletrica: ['ELÉTRICA', 27.3, 26.1],
  salao: ['SALÃO', 19.7, 12.9],
  circ_wc: ['WC', 30.15, 12.15],
};

export function makeCameraMap({ canvas, selector, onSelect }) {
  const svg = makeSvg('svg', {
    viewBox: '0 0 380 332',
    role: 'img',
    'aria-label': 'Planta V8: 12 câmeras nas coordenadas reais do restaurante',
  });
  const defs = makeSvg('defs');
  const pattern = makeSvg('pattern', {id:'map-grid', width:SCALE * 2, height:SCALE * 2, patternUnits:'userSpaceOnUse'});
  pattern.append(makeSvg('path', {d:`M ${SCALE * 2} 0 L 0 0 0 ${SCALE * 2}`,fill:'none',stroke:'#93a1bd','stroke-width':'.4',opacity:'.20'}));
  defs.append(pattern);
  svg.append(defs);
  svg.append(makeSvg('rect', {width:380,height:332,fill:'url(#map-grid)'}));

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
    svg.append(makeSvg('text',{x:X((x0+x1)/2),y:Y((y0+y1)/2)+3,class:'map-label'},'PALCO'));
  }

  for (const opening of VENUE.openings) {
    const {axis,at,start,end,type} = opening;
    const horizontal = axis === 'H';
    svg.append(makeSvg('line', {
      x1: X(horizontal ? start : at),
      y1: Y(horizontal ? at : start),
      x2: X(horizontal ? end : at),
      y2: Y(horizontal ? at : end),
      class:`map-opening ${type==='portao'?'gate':type==='saida'?'exit':'passage'}`,
      'stroke-dasharray': type==='livre'?'3 2':'none',
    }));
  }

  for (const [_, [text,x,y]] of Object.entries(LABELS)) {
    svg.append(makeSvg('text',{x:X(x),y:Y(y)+3,class:'map-label'},text));
  }

  const cameraNodes = new Map();
  const cameraButtons = new Map();
  for (const cam of CAMERAS) {
    const px = X(cam.x), py = Y(cam.y);
    const g = makeSvg('g', {
      class:`map-camera ${cam.renderAvailable?'has-render':'no-render'}`,
      'data-cam':cam.id,
      tabindex:'0',
      role:'button',
      'aria-label':`${cam.id}: ${cam.name}${cam.renderAvailable?'':' (somente planta técnica)'}`,
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
    g.addEventListener('click', () => onSelect(cam.id));
    g.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(cam.id);
      }
    });
    const tip = makeSvg('title',{},`${cam.id} — ${cam.name}`);
    g.append(tip);
    svg.append(g);
    cameraNodes.set(cam.id,g);

    const button=document.createElement('button');
    button.type='button';
    button.className=`camera-chip ${cam.renderAvailable?'':'reference'}`;
    button.dataset.cam=cam.id;
    button.title=`${cam.id} • ${cam.name}${cam.renderAvailable?'':' • referência técnica'}`;
    button.setAttribute('aria-label',button.title);
    const dot=document.createElement('i');dot.className='chip-dot';dot.setAttribute('aria-hidden','true');
    const num=document.createElement('span');num.textContent=String(cam.number).padStart(2,'0');
    button.append(dot,num);
    button.addEventListener('click',()=>onSelect(cam.id));
    selector.append(button);
    cameraButtons.set(cam.id,button);
  }

  canvas.append(svg);
  return {
    setActive(camera) {
      for (const [id,node] of cameraNodes) {
        node.classList.toggle('active',id===camera.id);
        node.setAttribute('aria-pressed',String(id===camera.id));
      }
      for (const [id,button] of cameraButtons) {
        button.classList.toggle('active',id===camera.id);
        button.setAttribute('aria-pressed',String(id===camera.id));
      }
      for (const [id,polygon] of polygons) polygon.classList.toggle('highlight',id===camera.room);
    },
  };
}
