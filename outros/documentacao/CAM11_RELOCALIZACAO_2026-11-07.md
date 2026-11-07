# CAM11 — realocação operacional (07/11/2026)

## Parâmetros definitivos
| Campo | Valor |
|---|---|
| Câmera | CAM11 |
| Sala / nome | retirada / Retirada • Corredor |
| Posição | (17,75; 27,75) m, canto nordeste |
| Altura da lente | 2,8 m |
| Azimute horizontal | 223° (cartesiano, 0° leste, 90° norte) |
| FOV horizontal | 90° |
| Alcance de cálculo 2D | 18 m |

A retirada ocupa X=10,8–18,0 m, Y=24,4–28,0 m. Balcão: X=14,2–16,9 m, Y=24,85–25,6 m. P10: passagem larga na parede sul Y=24,4 m, X=12,9–17,1 m. P09: passagem a oeste X=10,8 m, Y=25,3–26,5 m. Nenhuma mudança de parede, abertura, portão ou mobiliário. CAM12 permanece no corredor leste a (32,22; 23,25) m, azimute 180°, FOV 82°. Total: 12 câmeras.

## Campo de visão e derivados
O script original de geração de mapas continua sendo `outros/planta/nathzinha_v7_planta_tecnica.py`, com paredes bloqueantes e passagens livres. A rotina `.github/workflows/cam11-reference.yml` (na branch de realocação) executa os testes geométricos e regenera:
- `outros/planta/nathzinha_v7_visibilidade_calculada.json`;
- `outros/planta/nathzinha_v7_planta_tecnica.svg`;
- `public/reference/cameras/CAM11_visao.png`;
- `public/reference/maps/nathzinha_v7_planta_tecnica.png`;
- `public/reference/maps/nathzinha_v7_todos_campos_de_visao.png`;
- `public/reference/maps/nathzinha_v7_12_cameras_vistas.png`.

As CAM01–CAM10 e CAM12 individuais são calculadas apenas em diretório temporário, nunca sobrescritas. As outras 11 posições, imagens finais e configurações permanecem idênticas. A linha direcional da CAM11 no mapa usa azimute cartesiano, enquanto as outras setas legadas são preservadas. O site continua 100% estático, sem build.

## Status da nova arte 3D: PENDENTE
Não reutilizar o corredor antigo como se fosse a retirada. O jogo usa imagem técnica da CAM11 como fallback `image=null`, `renderAvailable=false` em `src/data/game-data.js`. Os arquivos `public/images/cameras/CAM11.webp` e `public/images/cameras/originals/CAM11.png` permanecem legados no repositório, desativados no jogo. Para finalizar a parte artística, produzir e aprovar uma renderização cinematográfica 16:9 da retirada desde a lente (17,75; 27,75), com balcão, P09 e P10 coerentes; substituir o WebP/PNG nos mesmos caminhos e reativar o campo `image`/flag.

## Registros de V8 preservados
O manifesto e mapa de hashes em `outros/documentacao/MANIFESTO_V8.json` e `MAPEAMENTO_ORIGINAIS.json` são históricos e não foram reescritos. O sufixo v7 nos caminhos operacionais é mantido para compatibilidade, sem afirmar que o conteúdo regenerado é o original.
