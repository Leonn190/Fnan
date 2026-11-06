#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Planta técnica v7 do Restaurante da Nathzinha.

Suporta salas retangulares e poligonais, calcula campos de visão 2D das câmeras,
considerando paredes sólidas e portões eventualmente fechados.
"""
import argparse, json, math
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Rectangle, Polygon as MplPolygon
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

COLOR_PASS = '#0284c7'
COLOR_GATE = '#dc2626'
COLOR_EXIT = '#16803c'
COLOR_CAM = '#6d28d9'
ROOM_FILLS = {'sala':'#fcfcfc', 'corredor':'#edf3f6', 'salao':'#f8f8f5'}
FOV_COLORS = [plt.get_cmap('tab20')(i) for i in [0,2,4,6,8,10,12,14,16,18,1,3]]


def room_shape(room):
    if 'poligono_m' in room:
        return Polygon(room['poligono_m'])
    return box(*room['retangulo_m'])


def all_lines(geom):
    if geom.is_empty:
        return
    if geom.geom_type == 'LineString':
        yield geom
    elif hasattr(geom,'geoms'):
        for sub in geom.geoms:
            yield from all_lines(sub)


def aperture_line(op):
    f = op['coordenada_fixa_m']; a = op['inicio_m']; b = op['fim_m']
    return LineString([(a,f),(b,f)]) if op['eixo']=='H' else LineString([(f,a),(f,b)])


def geometries(data, closed_gates=None):
    width = data['edificio']['largura_m']; height = data['edificio']['profundidade_m']
    footprint = box(0,0,width,height)
    room_poly = {r['id']: room_shape(r) for r in data['salas']}
    polys = list(room_poly.values())
    coverage = unary_union(polys)
    if coverage.symmetric_difference(footprint).area > 1e-5:
        raise ValueError('As salas não cobrem exatamente o edifício.')
    for i, r in enumerate(data['salas']):
        for other in data['salas'][i+1:]:
            inter = room_poly[r['id']].intersection(room_poly[other['id']]).area
            if inter > 1e-6:
                raise ValueError(f'Sobreposição: {r["id"]} × {other["id"]} = {inter}')
    raw_walls = unary_union([p.boundary for p in polys])
    op_lines = []
    for d in data['aberturas']:
        ln = aperture_line(d)
        if ln.difference(raw_walls.buffer(0.001)).length > 0.003:
            raise ValueError(f'Abertura {d["id"]} não está sobre uma parede.')
        op_lines.append(ln)
    solids = raw_walls.difference(unary_union(op_lines))
    closed_gates = set(closed_gates or [])
    blocked = unary_union([solids] + [aperture_line(d) for d in data['aberturas'] if d['id'] in closed_gates])
    segs = []
    for ln in all_lines(blocked):
        coords = list(ln.coords)
        for a,b in zip(coords[:-1], coords[1:]):
            if math.dist(a,b) > 1e-7:
                segs.append((a,b))
    wall_arr = np.array(segs, float)
    return room_poly, footprint, list(all_lines(blocked)), wall_arr


def determine_connection(op, room_polys):
    ln = aperture_line(op); m = ln.interpolate(0.5, normalized=True)
    eps = 0.08
    points = ([Point(m.x, m.y-eps), Point(m.x, m.y+eps)] if op['eixo']=='H'
              else [Point(m.x-eps, m.y), Point(m.x+eps, m.y)])
    names = []
    for p in points:
        names.append(next((k for k,poly in room_polys.items() if poly.buffer(1e-9).contains(p)), 'EXTERIOR'))
    return names


def field_polygon(camera, walls, footprint, rays=721):
    cx, cy = camera['posicao_lente_m']
    heading = camera['azimute_graus']; fov = camera['abertura_horizontal_graus']
    reach = camera['alcance_max_m']
    angles = np.deg2rad(np.linspace(heading-fov/2, heading+fov/2, rays))
    dirs = np.stack((np.cos(angles), np.sin(angles)), axis=1)
    A = walls[:,0,:]; B = walls[:,1,:]; V = B-A
    RX = A[:,0]-cx; RY = A[:,1]-cy
    denom = dirs[:,0,None]*V[None,:,1] - dirs[:,1,None]*V[None,:,0]
    with np.errstate(divide='ignore', invalid='ignore'):
        t = (RX[None,:]*V[None,:,1] - RY[None,:]*V[None,:,0]) / denom
        u = (RX[None,:]*dirs[:,1,None] - RY[None,:]*dirs[:,0,None]) / denom
    good = (np.abs(denom)>1e-10) & (t>1e-6) & (u>=-1e-8) & (u<=1+1e-8)
    dist = np.where(good, t, np.inf).min(axis=1)
    dist = np.minimum(dist, reach)
    hit = dirs*dist[:,None] + np.array([cx,cy])
    poly = Polygon([(cx,cy)] + hit.tolist())
    if not poly.is_valid:
        poly = poly.buffer(0)
    return poly.intersection(footprint)


def polygon_patch(ax, geom, facecolor, edgecolor='none', alpha=0.25, zorder=2, lw=0.8):
    if geom.is_empty:
        return
    if geom.geom_type == 'Polygon':
        if geom.area > 0.00005:
            ax.add_patch(MplPolygon(np.asarray(geom.exterior.coords), closed=True,
                                    facecolor=facecolor, edgecolor=edgecolor, lw=lw,
                                    alpha=alpha, zorder=zorder))
    elif hasattr(geom, 'geoms'):
        for g in geom.geoms:
            polygon_patch(ax, g, facecolor, edgecolor, alpha, zorder, lw)


def draw_aperture(ax, op, small=False, closed_gates=None):
    ln = aperture_line(op); xy = np.array(ln.coords)
    a,b = xy[0], xy[-1]; mid = (a+b)/2
    kind = op['tipo']
    color = {'portao':COLOR_GATE, 'livre':COLOR_PASS, 'saida':COLOR_EXIT}[kind]
    length = float(np.linalg.norm(b-a)); direction = (b-a)/length
    normal = np.array([-direction[1], direction[0]])
    lw = 3 if small else 4.5
    if kind == 'portao':
        ax.plot(xy[:,0], xy[:,1], color=color, lw=lw, linestyle='--', zorder=15)
        if closed_gates and op['id'] in closed_gates:
            ax.plot(xy[:,0], xy[:,1], color=color, lw=lw+1.2, alpha=.55, zorder=16)
    else:
        ax.plot(xy[:,0], xy[:,1], color='white', lw=lw+1.5, zorder=14)
        ax.plot(xy[:,0], xy[:,1], color=color, lw=1.2, ls=':', zorder=15)
    tick = .19 if not small else .13
    for p in [a,b]:
        p1 = p+normal*tick; p2 = p-normal*tick
        ax.plot([p1[0],p2[0]], [p1[1],p2[1]], color=color, lw=lw, solid_capstyle='round', zorder=20)
    if kind == 'saida' and not small:
        q = mid+normal*.28
        ax.annotate('', xy=q+normal*.65, xytext=q,
                    arrowprops=dict(arrowstyle='-|>', color=COLOR_EXIT, lw=1.8), zorder=21)


def draw_cameras(ax, data, selected=None, small=False):
    for c in data['cameras']:
        alpha = 1.0 if selected is None or c['id']==selected else 0.25
        x,y = c['posicao_lente_m']; h = np.deg2rad(c['azimute_graus'])
        dx,dy = np.cos(h), np.sin(h)
        ax.plot(x,y, marker='o', ms=5 if small else 7, color='white',
                markeredgecolor=COLOR_CAM, markeredgewidth=1.6, zorder=25, alpha=alpha)
        ax.arrow(x,y,dx*.62,dy*.62, width=.055 if not small else .035,
                 head_width=.24 if not small else .15, length_includes_head=True,
                 color=COLOR_CAM, alpha=alpha, zorder=25)
        if not small:
            ax.text(x+(0.65 if dx>=0 else -0.65), y+(0.45 if dy>=0 else -0.45),
                    c['id'].replace('CAM','C'), fontsize=8, fontweight='bold', ha='center', va='center',
                    color='#31165b', bbox=dict(boxstyle='round,pad=.14', fc='white', ec='none', alpha=.88), zorder=35)
        elif c['id']==selected:
            ax.text(x+.55, y+.5, c['id'], fontsize=7.5, fontweight='bold', zorder=30,
                    color='#31165b', bbox=dict(fc='white', ec='none', alpha=.8, pad=1))


def draw_room_objects(ax, data):
    for furn in data.get('elementos_fixos', []):
        x0,y0,x1,y1 = furn['retangulo_m']
        rect = Rectangle((x0,y0), x1-x0, y1-y0,
                         facecolor=('#cbd5e1' if furn['tipo']=='palco' else '#eaecf0'),
                         alpha=.6, edgecolor='#8394a1', lw=1.0,
                         linestyle='--' if furn['tipo']=='palco' else '-', zorder=2)
        ax.add_patch(rect)
        if furn['id'] in ('PALCO','BALCAO_ENTRADA','BALCAO_RETIRADA','MESA_CONTROLE','MESA_VIP1','MESA_VIP2'):
            lbl = 'PALCO' if furn['tipo']=='palco' else furn['nome'].replace('Balcão ','').replace('Mesa principal ','')
            ax.text((x0+x1)/2, (y0+y1)/2, lbl, ha='center', va='center', fontsize=7,
                    fontweight='bold', color='#596570', zorder=3)


def base(ax, data, room_polys, walls, labels=True, objects=True, grid=True, small=False, closed_gates=None):
    W = data['edificio']['largura_m']; H = data['edificio']['profundidade_m']
    ax.set_xlim(-1.1,W+1.1); ax.set_ylim(-1.1,H+1.1)
    ax.set_aspect('equal', adjustable='box'); ax.set_facecolor('white')
    for r in data['salas']:
        geom = room_polys[r['id']]
        polygon_patch(ax, geom, ROOM_FILLS.get(r['tipo'], 'white'), alpha=1.0, zorder=0)
    if grid:
        ax.set_xticks(np.arange(0, W+1, 2.5)); ax.set_yticks(np.arange(0, H+1, 2.5))
        ax.grid(True, which='major', lw=.35, color='#b9c2c9', alpha=.4, zorder=0)
    if objects:
        draw_room_objects(ax, data)
    for ln in walls:
        c = np.array(ln.coords)
        ax.plot(c[:,0], c[:,1], color='#101820', lw=2.5 if small else 3.0, zorder=10)
    for op in data['aberturas']:
        draw_aperture(ax, op, small=small, closed_gates=closed_gates)
    if labels:
        for r in data['salas']:
            x,y = r.get('rotulo_m', [room_polys[r['id']].representative_point().x, room_polys[r['id']].representative_point().y])
            name = r['nome'].upper()
            subtitle = r.get('medidas_rotulo','')
            fs = 7.0 if small else 8.7
            if r['tipo']=='corredor': fs = 6.8 if small else 7.4
            if r['tipo']=='salao': fs = 8.5 if small else 11.0
            ax.text(x, y, f'{name}\n{subtitle}', ha='center', va='center', fontsize=fs,
                    color='#22282e', zorder=7, fontweight='bold' if not small else 'normal', linespacing=1.3)
    if not small:
        ax.set_xlabel('X (metros) → leste', fontsize=10)
        ax.set_ylabel('Y (metros) → norte', fontsize=10)
        ax.tick_params(labelsize=8)
    else:
        ax.set_xticks([]); ax.set_yticks([])
        for sp in ax.spines.values(): sp.set_visible(False)


def scale_bar(ax):
    y = -.8
    ax.plot([.3,10.3], [y,y], lw=2, color='#202124')
    for x in [.3,5.3,10.3]:
        ax.plot([x,x], [y-.13, y+.13], lw=2, color='#202124')
    for x,t in [(.3,'0'), (5.3,'5m'), (10.3,'10m')]:
        ax.text(x, y+.18, t, ha='center', va='bottom', size=7.8)


def generate_plan(data, room_polys, walls, closed_gates, out):
    fig = plt.figure(figsize=(19,16), dpi=170)
    ax = fig.add_axes([.055,.105,.68,.79])
    base(ax, data, room_polys, walls, labels=True, objects=True, grid=True, small=False, closed_gates=closed_gates)
    draw_cameras(ax, data)
    scale_bar(ax)
    fig.text(.052,.954,'RESTAURANTE DA NATHZINHA | PLANTA TÉCNICA V7', size=18, weight='bold')
    fig.text(.052,.93,'Revisão V7: portão da Sala de Controle centralizado; CAM11 girada 4° à direita', size=10.6)
    fig.text(.747,.874,'LEGENDA', size=14, weight='bold')
    entries=[('Paredes opacas','#111827'),('Porta / passagem livre',COLOR_PASS),('Portão mecânico (G)',COLOR_GATE),('Saída externa',COLOR_EXIT),('Câmera com direção',COLOR_CAM)]
    for j,(lbl,c) in enumerate(entries):
        yy=.84-j*.034
        fig.add_artist(plt.Line2D([.752,.784],[yy,yy], transform=fig.transFigure, color=c, lw=3))
        fig.text(.795, yy, lbl, va='center', fontsize=10)
    fig.text(.747,.64,'CÂMERAS', size=13, weight='bold')
    room_names={r['id']:r['nome'] for r in data['salas']}
    for j,c in enumerate(data['cameras']):
        yy=.612-j*.032
        desc=room_names[c['sala']]
        if len(desc)>27: desc = desc[:26]+'…'
        fig.text(.748, yy, f'{c["id"]}  {desc}', size=8.9, va='center')
    fig.text(.052,.058,'Referência geométrica em metros. As áreas visíveis das câmeras consideram apenas oclusão de paredes/portões em 2D.', size=9.8)
    fig.text(.052,.038,'Portões fechados na simulação: '+(', '.join(sorted(closed_gates)) or 'nenhum')+'.', size=9.8)
    png = out/'nathzinha_v7_planta_tecnica.png'; svg = out/'nathzinha_v7_planta_tecnica.svg'
    fig.savefig(svg, bbox_inches='tight', facecolor='white')
    fig.savefig(png, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return svg, png


def generate_overview(data, room_polys, walls, fields, out, closed_gates):
    fig,ax = plt.subplots(figsize=(15.4,13.8), dpi=160)
    base(ax, data, room_polys, walls, labels=False, objects=False, grid=False, small=False, closed_gates=closed_gates)
    for i,c in enumerate(data['cameras']):
        polygon_patch(ax, fields[c['id']], FOV_COLORS[i], alpha=.13, zorder=3)
    draw_cameras(ax, data)
    ax.set_title('Visão geral: 12 campos de visão (projeção 2D, cortados pelas paredes)', size=13, weight='bold', pad=12)
    ax.text(.2,-.9, 'Portões fechados: '+(', '.join(sorted(closed_gates)) or 'nenhum')+'  |  Aberturas livres permitem visada', fontsize=9)
    path = out/'nathzinha_v7_todos_campos_de_visao.png'
    fig.tight_layout(); fig.savefig(path, bbox_inches='tight', facecolor='white'); plt.close(fig)
    return path


def generate_grid(data, room_polys, walls, fields, out, closed_gates):
    fig,axs = plt.subplots(3,4, figsize=(22,18), dpi=150)
    files=[]
    for idx,c in enumerate(data['cameras']):
        ax = axs.flat[idx]
        base(ax, data, room_polys, walls, labels=False, objects=True, grid=False, small=True, closed_gates=closed_gates)
        polygon_patch(ax, fields[c['id']], FOV_COLORS[idx], alpha=.38, zorder=4)
        draw_cameras(ax, data, selected=c['id'], small=True)
        ax.set_title(f'{c["id"]}  |  {c["azimute_graus"]}°  |  FOV {c["abertura_horizontal_graus"]}°', fontsize=11, fontweight='bold')
        sep,sub = plt.subplots(figsize=(12,11), dpi=160)
        base(sub, data, room_polys, walls, labels=True, objects=True, grid=True, small=False, closed_gates=closed_gates)
        polygon_patch(sub, fields[c['id']], FOV_COLORS[idx], alpha=.39, zorder=4)
        draw_cameras(sub, data, selected=c['id'], small=False)
        sep.suptitle(f'{c["id"]}: {c["observacao_enquadramento"]}', fontsize=12.2, weight='bold', y=.985)
        sep.text(.5,.03, f'Posição {c["posicao_lente_m"]} m  |  altura {c["altura_lente_m"]}m  |  azimute {c["azimute_graus"]}°  |  abertura {c["abertura_horizontal_graus"]}°', ha='center', fontsize=10)
        dst = out/'cameras'/f'{c["id"]}_visao.png'
        sep.savefig(dst, bbox_inches='tight', facecolor='white'); plt.close(sep)
        files.append(dst)
    fig.suptitle('VISIBILIDADE REAL EM PLANTA  |  12 câmeras  |  versão v7 — ajustes finos', fontsize=17, fontweight='bold', y=.995)
    fig.tight_layout(rect=(0,0,.99,.98), h_pad=1.2, w_pad=.4)
    overview = out/'nathzinha_v7_12_cameras_vistas.png'
    fig.savefig(overview, bbox_inches='tight', facecolor='white'); plt.close(fig)
    return overview, files


def enrich(data, room_polys, fields, blocked_arr, closed_gates):
    result = json.loads(json.dumps(data, ensure_ascii=False))
    closed_gates=set(closed_gates)
    for op in result['aberturas']:
        op['conecta'] = determine_connection(op, room_polys)
        op['passagem_pessoas'] = True
        op['passagem_visao_modo_atual'] = op['id'] not in closed_gates
        op['passagem_pessoas_modo_atual'] = op['id'] not in closed_gates
    for c in result['cameras']:
        poly = fields[c['id']]
        hits=[]
        for r in result['salas']:
            a = poly.intersection(room_polys[r['id']]).area
            if a >= .04:
                hits.append({'sala':r['id'],'nome':r['nome'],'area_visivel_aprox_m2':round(a,2),'fracao_area_sala_aprox':round(a/r['area_m2'],3) if r['area_m2'] else 0})
        hits.sort(key=lambda x:x['area_visivel_aprox_m2'], reverse=True)
        c['area_visivel_total_dentro_edificio_m2'] = round(poly.area,2)
        c['salas_com_visao_2d'] = hits
        c['poligono_visibilidade_2d_m'] = [[round(x,3),round(y,3)] for x,y in list(poly.exterior.coords)] if poly.geom_type=='Polygon' else []
    overlaps=[]
    for i,c in enumerate(result['cameras']):
        for other in result['cameras'][i+1:]:
            a = fields[c['id']].intersection(fields[other['id']]).area
            if a >= .1:
                per_room=[]
                both = fields[c['id']].intersection(fields[other['id']])
                for r in result['salas']:
                    ar = both.intersection(room_polys[r['id']]).area
                    if ar >= .1: per_room.append({'sala':r['id'], 'area_m2':round(ar,2)})
                overlaps.append({'camera_a':c['id'],'camera_b':other['id'],'area_comum_m2':round(a,2),'salas':per_room})
    overlaps.sort(key=lambda d:d['area_comum_m2'], reverse=True)
    result['resultado_calculado'] = {
        'estado_portoes':'mistos' if closed_gates else 'abertos',
        'portoes_fechados':sorted(closed_gates),
        'pares_com_sobreposicao':overlaps,
        'segmentos_de_parede_solida_m':[{'p1_m':[round(v,3) for v in a], 'p2_m':[round(v,3) for v in b], 'comprimento_m':round(math.dist(a,b),3)} for a,b in blocked_arr],
        'comprimento_total_paredes_solidas_m':round(sum(math.dist(a,b) for a,b in blocked_arr),2)
    }
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, default=Path(__file__).with_name('nathzinha_v7_planta_medidas.json'))
    parser.add_argument('--out', type=Path, default=Path(__file__).parent)
    parser.add_argument('--fechar', nargs='*', default=[], metavar='GNN')
    args = parser.parse_args()

    data = json.loads(args.data.read_text(encoding='utf-8'))
    args.out.mkdir(parents=True, exist_ok=True); (args.out/'cameras').mkdir(exist_ok=True)
    room_polys, footprint, walls, blockers = geometries(data, closed_gates=args.fechar)
    fields = {c['id']: field_polygon(c, blockers, footprint) for c in data['cameras']}
    detailed = enrich(data, room_polys, fields, blockers, args.fechar)
    vis_json = args.out/'nathzinha_v7_visibilidade_calculada.json'
    vis_json.write_text(json.dumps(detailed, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')
    generate_plan(data, room_polys, walls, set(args.fechar), args.out)
    generate_overview(data, room_polys, walls, fields, args.out, set(args.fechar))
    generate_grid(data, room_polys, walls, fields, args.out, set(args.fechar))
    print('Arquivos gravados em', args.out)

if __name__ == '__main__':
    main()
