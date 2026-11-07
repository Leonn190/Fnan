# Restaurante da Nathzinha — Web V1 🌸

Primeira versão navegável do fangame de terror **Restaurante da Nathzinha**. O jogo abre diretamente no escritório de segurança: explore a imagem panorâmica, clique no monitor da mesa e alterne entre as doze câmeras pela planta interativa do restaurante.

**Projeto estático puro:** HTML + CSS + JavaScript com scripts locais. Não depende de Node.js, npm, Vite, Astro, bundlers, servidores próprios, banco de dados ou etapa de build. Desenvolvido para hospedar diretamente no **GitHub Pages**.

## Estrutura

```text
Restaurante_da_Nathzinha_Web_V1/
├── index.html                       # Entrada do site: já abre no escritório
├── .nojekyll                        # Não processar pastas pelo Jekyll
├── .github/workflows/pages.yml      # Publicação automática, sem build
├── src/                             # Código do jogo/site
│   ├── main.js                      # Escritório, monitor, noite, HUD, entradas
│   ├── map.js                       # Mapa clicável da planta real
│   ├── sound.js                     # Efeitos sonoros gerados no navegador
│   ├── data/game-data.js            # Dados autoritativos exportados da planta
│   └── styles/main.css              # Interface e animações
├── public/                          # Recursos consumidos pelo navegador
│   ├── images/
│   │   ├── office/                  # Panorama usado no jogo + PNG original
│   │   ├── cameras/                 # WEBP otimizadas: CAM01–12
│   │   │   └── originals/           # Imagens PNG originais preservadas
│   │   ├── animatronics/            # As três artes 2D, não aparecem nesta V1
│   │   └── branding/                # Ícone do site
│   ├── reference/
│   │   ├── cameras/                 # CAM01...CAM12_visao.png, visões técnicas 2D
│   │   └── maps/                    # Imagens da planta V7/V8
│   └── models/                      # Reserva para futuros modelos 3D
└── outros/                          # Arquivos de produção e documentação
    ├── documentacao/               # V8, checklist, manifesto e hashes
    ├── identidade_visual/          # Bíblia visual, paleta e materiais
    ├── planta/                     # Fonte técnica em JSON/Python/SVG
    └── prompts/                     # Prompt mestre + 12 prompts de câmera
```

O arquivo `outros/documentacao/MAPEAMENTO_ORIGINAIS.json` registra **os 60 arquivos originais** do ZIP V8: de onde vieram, onde foram colocados, hashes SHA-256 e tamanho original. Esses arquivos foram copiados sem modificações. A versão para o navegador usa imagens WEBP menores, preservando os PNG mestres.

## Publicar no GitHub Pages (sem build)

1. Crie um repositório no GitHub e coloque **o conteúdo desta pasta** na raiz da branch `main`. `index.html` deve ficar na raiz, não dentro de outra pasta.
2. Em **Settings → Pages → Build and deployment**, escolha **GitHub Actions** como fonte.
3. O workflow `.github/workflows/pages.yml` publicará os arquivos estáticos do repositório automaticamente. Nenhum `npm install`, `npm run build` ou build local é necessário.
4. Acesse a URL indicada em **Settings → Pages**, normalmente `https://seu-usuario.github.io/nome-do-repo/`.

Também funciona com a opção clássica **Deploy from a branch → main → /(root)** em repositórios que permitam essa modalidade. Os endereços são relativos (`./public/...`, `./src/...`) e funcionam tanto no site de projeto quanto no site de usuário.

## Testar localmente e enquadramento

Abra `index.html` diretamente no navegador, inclusive por `file://`. Os scripts locais carregam em ordem, sem módulos ES ou requisições de dados que exijam servidor. Também funciona por HTTP e no GitHub Pages.

A área do jogo tem largura máxima de 16:9, centralizada sobre fundo preto. Monitores ultrawide, incluindo modelos curvos, recebem bordas pretas nas laterais: escritório, câmeras, mapa e HUD usam a mesma área útil. A curvatura física não é detectável pelo navegador; a proporção da tela define as bordas. O movimento do panorama usa as bordas da área do jogo.

## Como jogar

- **Ao entrar:** você já está no escritório, olhando a imagem panorâmica.
- **Mouse nas bordas esquerda/direita** ou **A/D e ←/→** no escritório: olhar para os lados.
- **Toque e arraste** no escritório em telas touch: deslocar o panorama.
- **Clique no monitor da mesa**, clique na aba inferior ou pressione **Espaço/M**: abrir/fechar as câmeras.
- **Na tela de câmeras:** clique em uma das 12 câmeras na planta ou use as setas **←/→**.
- **Portões no mapa:** clique para alternar entre aberto (amarelo) e fechado (vermelho). Ao fechar um quarto portão, o último que havia sido fechado abre automaticamente. Os portões voltam a abrir ao reiniciar o turno.
- **F no escritório:** alterna a luz circular no corredor. Ao abrir o monitor ou trocar de janela, a luz desliga. Com o G01 fechado, a luz não revela o corredor.
- **G01 no mapa:** abre/fecha o portão principal do escritório. O estado acompanha também a reabertura automática pelo limite de três fechados.
- **Esc:** abaixa o monitor.
- O contador de horas vai de 12 AM a 6 AM; ao terminar, é possível reiniciar. Sem animatrônicos, dano, ataques ou mortes nesta versão.

## Câmeras e imagens disponíveis

| ID | Sala da planta | Recurso exibido |
|---|---|---|
| CAM01 | Lojinha | Cena 3D final |
| CAM02 | Recepção | Cena 3D final |
| CAM03 | Salão principal, virada para o palco | Nova cena do palco |
| CAM04 | Salão principal, parede oposta | Portão sul G08 aberto ou fechado |
| CAM05 | VIP 1 rosa | Quatro estados visuais dos portões G04/G05 |
| CAM06 | VIP 2 lavanda | Cena 3D final |
| CAM07 | Fliperama | Cena 3D final |
| CAM08 | Estoque | Cena 3D 4K |
| CAM09 | Área de serviço | Cena da sala técnica |
| CAM10 | Cozinha | Cena 3D final |
| CAM11 | Área de Retirada • Corredor | Visão técnica até nova arte 3D da retirada |
| CAM12 | Corredor de serviço, leste | Cena 3D do corredor da retaguarda |

O projeto continua com 12 câmeras. **CAM11 foi realocada** para a área de retirada: até uma renderização 3D genuína da nova perspectiva ser produzida, o jogo exibe apenas a visão técnica `public/reference/cameras/CAM11_visao.png`. O antigo WebP/PNG de CAM11 permanece no repositório como referência legada, **não exibida no jogo**. As outras 11 câmeras mantêm suas imagens e geometria. As plantas técnicas continuam disponíveis como fallback. O manifesto V8 é um registro histórico, anterior à substituição da arte do palco e à inclusão da CAM04 e CAM09.

Na CAM04, o portão à esquerda acompanha o G08, entre a recepção e a parede sul do salão. A imagem padrão mostra o portão aberto com breu atrás; fechar o G08 mostra o portão baixado. Detalhes e prompt: `outros/prompts/CAM04_ESTADOS_PORTAO.md`.

A CAM05 começa com os dois portões abertos, mostrando breu nas aberturas. Os portões G04/G05 no mapa controlam as quatro imagens da sala, inclusive quando um deles é reaberto automaticamente pelo limite de três fechados. A sala usa a mesma base de pixels em todos os estados. Detalhes e prompts: `outros/prompts/CAM05_ESTADOS_PORTOES.md`. G04 controla a esquerda e G05 a direita na imagem.

Verificação dos portões e escritório: `node tests/camera-gates.cjs` testa a luz F, os três estados do escritório, a CAM05 e a ligação com os portões. `python tests/test_cam05_images.py` e `python tests/test_office_images.py` (Pillow) conferem a consistência dos cenários.

Os três estados da nova sala de controle estão em `public/images/office/states/`. O PNG mestre é a arte nova, e a área clicável acompanha o monitor à esquerda da mesa. Prompts e composição: `outros/prompts/ESCRITORIO_ESTADOS_PORTAO.md`.

O mapa da interface usa os **polígonos, aberturas, posições e azimutes das 12 câmeras** exportados de `nathzinha_v7_planta_medidas.json` para `src/data/game-data.js`. Para a CAM11, a seta segue a convenção cartesiana verdadeira do gerador (0°=leste, 90°=norte). As outras 11 setas legadas mantêm a aparência anterior. Ver `outros/documentacao/CAM11_RELOCALIZACAO_2026-11-07.md`. As plantas e documentos V8 continuam disponíveis como fonte de referência; o jogo não muda a arquitetura definida.

## Observações

- O projeto não usa os sprites dos animatrônicos ainda. Os três PNGs foram guardados em `public/images/animatronics/` para expansão futura.
- O pacote V8 não incluía arquivos 3D `.glb`/`.gltf`; `public/models/` foi preparado sem modelos inventados.
- Os efeitos de som são sintetizados localmente pelo navegador e começam após o primeiro clique ou tecla, conforme as regras do navegador.
- A sala do escritório é uma **imagem panorâmica pré-renderizada**, não um cenário 3D em tempo real.
- A V1 é uma **base de exploração e vigilância**, não um FNAF completo: ataques, IA, jumpscares e missões podem vir em versões futuras.
