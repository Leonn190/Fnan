# RESTAURANTE DA NATHZINHA — V8 (Arquitetura V7 + Identidade visual)

**Esta entrega V8 é uma atualização de direção de arte, não uma alteração de planta.** O ZIP contém os 19 arquivos originais da V7 **byte a byte idênticos**, e adiciona uma bíblia de identidade, dados estruturados, uma prancha de cores, um prompt mestre e 12 prompts específicos, um por câmera.

## Ordem de leitura (especialmente para outro chat de geração de imagens)
1. **`01_LEIA_PRIMEIRO_V8.md`** — este arquivo.
2. **`identidade_visual/02_BIBLIA_DE_ARTE_V8.md`** — estética, paleta, pôsteres, marca, materiais e modo noturno.
3. **`identidade_visual/03_AMBIENTES_V8.md`** — cada sala e o que não pode mudar.
4. **`identidade_visual/04_REGRAS_DE_CONTINUIDADE_E_CENAS.md`** — compromisso com geometria e fluxo de imagens.
5. **`prompts/00_PROMPT_MESTRE_OUTRO_CHAT.txt`** — instrução integral para gerar as imagens.
6. **`prompts/CAM01.txt` ... `prompts/CAM12.txt`** — prompts por câmera, com números e enquadramentos originais.
7. **`nathzinha_v7_planta_tecnica.png` e `nathzinha_v7_planta_medidas.json`** — fontes físicas autoritativas.
8. **`cameras/CAMXX_visao.png` e `nathzinha_v7_visibilidade_calculada.json`** — referencial de visibilidade horizontal.

## Prioridade entre arquivos
1. **Geometria e ângulo = V7 original**, principalmente `nathzinha_v7_planta_medidas.json` e `cameras/CAMXX_visao.png`.
2. **Aparência, ambientação e identidade = novos arquivos V8**.
3. **Prompt livre = apenas interpretação dos itens 1 e 2**, nunca substituição da planta.

## Fatos do projeto
- Planta: 32,5 × 28 m; 19 setores nomeados; 12 câmeras com posição/altura/azimute/FOV pré-existentes.
- O corredor de serviço é **um corredor em L**, não dois.
- A V8 mantém o portão da sala de controle centralizado e a CAM11 ajustada a 135°.
- Os PNGs existentes são mapas técnicos, não frames 3D ou imagens de cenário definitivas.
- FOV e visibilidade calculados são **projeções horizontais 2D**. Perspectiva 3D, obstáculos verticais e inclinação real exigem interpretação visual.
- A identificação interna `versao` nos JSONs V7 foi preservada literalmente (mesmo que seja um rótulo legado), para não corromper o pacote técnico.

## Entregáveis V8 adicionados
- Guia da direção de arte completo e guia de todos os 19 ambientes.
- Paleta editável JSON + prancha de amostras PNG/SVG.
- Sistema de branding original, ícones :3, lacinhos e pôsteres anime com personagens adultas.
- Regras de oclusão, iluminação dia/noite, consistência de materiais e exportação.
- 12 prompts independentes, cada um com coordenadas e FOV oficiais.
- Checklist de aprovação e manifesto com SHA-256 dos arquivos originais.

## Uso rápido
1. Em outro chat, envie este ZIP inteiro e peça que leia `01_LEIA_PRIMEIRO_V8.md`.
2. Escolha a câmera (recomendação: CAM03 como primeiro cenário de referência do salão).
3. Anexe ou extraia também o PNG da planta e `cameras/CAMXX_visao.png` em cada geração, pois nem todo gerador de imagem interpreta automaticamente arquivos dentro de ZIP.
4. Peça **uma imagem-mestra sem animatrônicos** para o ambiente e aprove paleta, mobiliário e objetos persistentes.
5. Gere a versão noturna e depois os demais ângulos, mantendo a mesma arquitetura e os mesmos props.
6. Verifique cada imagem pelo checklist antes de colocá-la no jogo.

**Nota:** A V8 não inclui imagens finais das câmeras. Inclui todas as especificações para produzi-las com consistência.
