# CAM05 — estados dos portões

Ferramenta: `image_gen` integrada, em modo de edição. Alvo das três gerações: `public/images/cameras/originals/CAM05.png`. O arquivo original foi preservado e continua sendo o estado com ambos fechados.

## Prompts usados

### Ambos abertos

Use case: precise-object-edit. Edit target: the attached CAM05 game background. Create ONE full-frame variant at exactly the same composition and dimensions/aspect ratio. Change ONLY the two hydraulic rolling shutter doors: fully raise/open BOTH doors, the one on the image left and the one on the image right. Each open doorway must be absolute pitch-black featureless darkness, with no corridor, no objects, no visible environment beyond it. Keep the original doorway frames/trim intact and stationary. The shutter slats and their yellow/black striped bottom edges must be lifted fully out of sight into the existing header; do not leave the bottom strip on the floor. Absolutely everything outside the two door interiors must remain unchanged: every chair, table, rug, lamp, flower, poster, mirror, pink bow, wall detail, floor tile, shadow, light, color, reflection, texture and the precise camera angle/framing. Preserve the pink indicator lamps as they are. Do NOT regenerate or redesign the room. No extra text, UI, animation panels or split screen; output one image.

### Somente esquerdo aberto

Use case: precise-object-edit. Edit target: attached original CAM05 game room image. Produce ONE full-frame variant with ONLY the LEFT hydraulic shutter door fully OPEN/raised into its original header, showing a completely pitch-black featureless void in its doorway. Remove the left shutter slats and the left yellow/black shutter bottom edge from view. The RIGHT shutter must remain CLOSED and completely identical to the original, including its striped lower edge. Preserve all fixed frames and original pink indicator lamps. ABSOLUTELY NO changes anywhere outside the left shutter opening: keep the precise same pixels/positions/lighting/colors for the room, chairs, table, all flowers, plants, rug, chandelier, mirror, posters, bows, foreground lamp in front of the left door, floor tiles, shadows and reflections. Keep the foreground lamp IN FRONT of the opening intact. No corridor or objects in the open doorway, only black. Preserve original resolution/aspect ratio and exact camera composition. Do not recreate or reinterpret the room. No panels, text or UI; output one image.

### Somente direito aberto

Use case: precise-object-edit. Edit target: attached original CAM05 game room image. Produce ONE full-frame variant with ONLY the RIGHT hydraulic shutter door fully OPEN/raised into its original header, showing a completely pitch-black featureless void in its doorway. Remove the right shutter slats and the right yellow/black shutter bottom edge from view. The LEFT shutter must remain CLOSED and completely identical to the original, including its striped lower edge. Preserve all fixed frames and original pink indicator lamps. ABSOLUTELY NO changes anywhere outside the right shutter opening: keep the precise same pixels/positions/lighting/colors for the room, chairs, table, all flowers, plants, rug, chandelier, mirror, posters, bows, foreground lamp, floor tiles, shadows and reflections. No corridor or objects in the open doorway, only black. Preserve original resolution/aspect ratio and exact camera composition. Do not recreate or reinterpret the room. No panels, text or UI; output one image.

## Preservação e arquivos finais

A geração introduziu pequenas diferenças fora das portas. Para os arquivos finais, essas áreas foram restauradas a partir do PNG original, sem recompressão com perdas. As aberturas pretas foram limitadas aos interiores dos portões; a luminária e o laço em primeiro plano foram preservados. Os mesmos recortes são usados nas combinações para evitar que a sala mude entre estados.

| Esquerdo na imagem | Direito na imagem | Arquivo em `public/images/cameras/` |
|---|---|---|
| Aberto | Aberto | `states/CAM05-open-open.png` (padrão) |
| Aberto | Fechado | `states/CAM05-open-closed.png` |
| Fechado | Aberto | `states/CAM05-closed-open.png` |
| Fechado | Fechado | `originals/CAM05.png` (original intacto) |

Todos os arquivos têm 1672 × 941 pixels. A troca altera a imagem completa, sem filtros ou animações adicionais na sala.

## Ligação com a planta

Vínculo visual corrigido conforme teste no jogo: G04 controla o portão à esquerda da imagem; G05 controla o portão à direita. Os arquivos de imagem continuam os mesmos.

Os quatro estados são declarados em `src/data/game-data.js`. O monitor reage a qualquer mudança nos portões, inclusive à reabertura automática ao atingir o limite de três fechados. Trocar de câmera ou baixar o monitor conserva os estados; reiniciar o turno abre todos.
