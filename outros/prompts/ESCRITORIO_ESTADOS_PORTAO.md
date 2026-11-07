# Sala de controle — portão e iluminação

A nova arte fornecida em `NOVA.png` é o PNG mestre `public/images/office/office-original.png`, com os mesmos bytes e dimensões de 2172 × 724. Ela já traz o corredor escuro. A arte e os estados da sala anterior foram retirados.

- `public/images/office/states/office-open-dark.webp`: portão aberto no breu, exportação sem perdas da nova arte.
- `public/images/office/states/office-open-lit.webp`: o corredor aparece no centro da luz circular.
- `public/images/office/states/office-closed.webp`: o portão cobre a passagem.

Os dois estados editados foram criados com o ImageGen integrado. Na finalização, somente a passagem recebeu os recortes gerados; a moldura e os objetos em primeiro plano foram preservados na nova arte. A sala mantém o panorama 3:1.

**F** alterna a luz circular quando o portão está aberto. **G01** no mapa controla o portão, inclusive em reaberturas automáticas. A área clicável foi movida para o monitor grande no lado esquerdo da mesa e acompanha o panorama.

## Prompts do ImageGen

### Fechado

Use case: precise-object-edit. Edit target: the attached NEW 2172×724 security control room panorama, with a large desktop computer monitor on the LEFT, pink radio and fan on the RIGHT, and a black central doorway. Change ONLY the black opening between the existing hydraulic pistons: close it with a heavy, horizontally ribbed dark plum steel rolling shutter, fitted below the existing hazard-striped header, down to the original threshold. Match the pink room's reflections, with a narrow yellow and black warning band on the shutter's lower edge. Preserve the new desktop monitor on the left, the walkie-talkie antenna in front of the door's left edge, mug at right, and all foreground objects. Every pixel outside the existing black opening must stay unchanged. Preserve the exact 3:1 panorama, original dimensions and crop. No changes to the side doors, framing, decor, light or furniture. No people, UI or added text. Output one full-frame scene.

### Aberto com luz circular

Use case: localized lighting edit. Image 1 is the sole EDIT TARGET: the NEW control room panorama, with a large computer on the left and fan and pink radio on the right. Image 2 is a visual reference ONLY for the corridor behind the central gate; never copy any foreground or office objects from image 2. In image 1 keep the central hydraulic gate open and the opening black except for one soft-edged circular flashlight beam in the middle, about two-thirds of the opening width. Within the beam reveal the same dim corridor from the reference, including the checkerboard floor, distant red torii motif and small hanging lanterns. Outside the beam keep the opening pitch black. Do not move or redraw anything in the new office: keep the monitor at left, mug at right, and walkie-talkie and antenna in the foreground intact. Only edit the black central opening. No new objects or people. Exact original camera pose and 2172×724 (3:1) framing. Return one full panorama without UI or text.

Na edição iluminada, o antigo panorama serviu apenas de referência para o corredor. Nenhum objeto ou pixel do antigo escritório foi copiado para a nova sala.

## Novas câmeras fornecidas

- `public/images/cameras/originals/CAM03.png` (antes `novacampalco.png`) → `CAM03.webp`, substituindo a arte antiga do palco (incluindo remoção do PNG antigo).
- `public/images/cameras/originals/CAM04.png` (antes `cam salao principal fantando.png`) → `CAM04.webp`, preenchendo o ângulo que faltava no salão.
- Os PNG fornecidos foram renomeados sem alterar seu conteúdo; os WEBP de base foram exportados com qualidade 88.
- CAM05: vínculo corrigido para G04 à esquerda e G05 à direita na imagem, conforme teste visual do usuário.
