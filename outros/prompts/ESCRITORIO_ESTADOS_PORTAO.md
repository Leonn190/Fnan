# Escritório — portão principal e iluminação F

Ferramenta: `image_gen` integrada, em modo de edição. Alvo: `public/images/office/office-original.png`, 2172 × 724. O original está preservado.

## Imagens finais

- `public/images/office/states/office-open-dark.webp`: estado inicial, portão aberto e corredor quase totalmente escuro.
- `public/images/office/states/office-open-lit.webp`: portão aberto, luz circular com borda suave revelando o corredor original.
- `public/images/office/states/office-closed.webp`: portão hidráulico fechado.

Os WEBP finais são sem perdas. Na finalização, os pixels fora da passagem central foram restaurados do original. O portão fechado aproveita a arte gerada dentro dessa passagem. A luz foi recomposta sobre o corredor original com um círculo de raio 138 px, centro (1086, 367), borda desfocada de 18 px. O estado escuro retém 3,5% da intensidade original do corredor; o centro iluminado revela os detalhes originais com intensidade até 1,75×. Mesa, rádio em primeiro plano, monitor, molduras, pistões e iluminação do restante da sala permanecem estáveis.

## Mecânica

G01 abre/fecha o portão principal pelo mapa. O escritório acompanha a reabertura automática do G01 quando o limite de três portões fechados exige isso. F alterna a luz apenas no escritório e com o portão aberto; repetição de tecla não alterna repetidamente. Abrir o monitor, perder o foco ou reiniciar o turno desliga a luz. O cenário inteiro, incluindo o círculo de luz, acompanha o panorama, sem aumentar o campo de visão em ultrawide.

## Prompts usados

### Portão fechado

Use case: precise-object-edit. Edit target is this existing 2172x724 panoramic game security office. Produce ONE same-size panorama. Change ONLY the central/front hydraulic gate: close it completely by lowering a heavy realistic ribbed steel security shutter inside the EXISTING central rectangular opening. It must fit exactly between the existing hydraulic columns and below the existing header, bottom edge at the existing threshold behind the desk. Dark plum-grey metal, subtle pink reflected office light, a narrow yellow/black safety band at its bottom. Entire corridor should be occluded by the closed solid shutter. The shutter is behind ALL original desk objects including the mug, desk edge, radio, monitors. Preserve every pixel outside that central opening: original room architecture, existing hydraulic pistons, frames, warning header, desk, fan, papers, monitors, posters, cabinet, flowers, lamps, walls, lights, colors, shadows and perspective. Do not move the desk or gate frame. No people or animatronics. No UI, text overlays, collage or reframing. Return one full panoramic background, matching the original 3:1 aspect ratio.

### Portão aberto / breu

Use case: lighting-weather, strict local edit of existing game background. Edit target: this 2172x724 security office panorama. Make ONLY the corridor seen through the central open hydraulic gate almost completely dark, near-total black, with essentially no visible detail in the distance. Keep gate fully OPEN and its existing hydraulic frame unchanged. The desk and its objects, fan, mug, radio, monitors, walls, all office lights, the cabinets, posters, side doorway, and all other pixels outside the central corridor opening must remain IDENTICAL. Do not darken the whole office. Only the recess beyond the central gate should become a pitch-dark corridor. Preserve original 3:1 panoramic framing, no new objects, no UI or collage. One full panoramic image.

### Portão aberto / luz circular

Use case: lighting-weather. Strict local edit of the attached 2172x724 panoramic security office. Only change the corridor INSIDE the central OPEN hydraulic gate: make it almost totally black except for ONE medium-sized ROUND flashlight beam in the middle of that opening, softly feathered, centered on the distant corridor, revealing the same original corridor furniture, hanging lanterns, torii ornament and checkerboard floor that are already in the reference. The beam should show the ORIGINAL corridor, not invent objects or new geometry. Outside the circular beam the hallway is pitch dark. Do NOT illuminate the whole doorway. Do NOT draw a flashlight object. Every pixel of the OFFICE OUTSIDE the central passage must be unchanged: door frame and pistons, header, desk, fan, mug, radio, monitors, cabinets, side door, posters, lamps, reflections, color and exposure. Same original 3:1 panorama, exact camera pose, one image, no UI, no text or panels.

## Novas câmeras fornecidas

- `public/images/cameras/novacampalco.png` → `CAM03.webp`, substituindo a arte antiga do palco (incluindo remoção do PNG antigo).
- `public/images/cameras/cam salao principal fantando.png` → `CAM04.webp`, preenchendo o ângulo que faltava no salão.
- Os novos PNG fornecidos foram mantidos intactos; WEBP foram exportados com qualidade 88.
- CAM05: vínculo corrigido para G04 à esquerda e G05 à direita na imagem, conforme teste visual do usuário.
