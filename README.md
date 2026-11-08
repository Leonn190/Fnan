# Nine Nights at Nath's — Web V1 🌸

Primeira versão navegável do fangame de terror **Nine Nights at Nath's**. Clique em **Jogar Nine Nights at Nath's** para abrir o menu com a trilha. Selecione **New Game** para entrar no escritório de segurança e acessar as doze câmeras do restaurante.

**Projeto estático puro:** HTML + CSS + JavaScript com scripts locais. Não depende de Node.js, npm, Vite, Astro, bundlers, servidores próprios, banco de dados ou etapa de build. Desenvolvido para hospedar diretamente no **GitHub Pages**.

## Estrutura

```text
Restaurante_da_Nathzinha_Web_V1/
├── index.html                       # Menu inicial e tela da noite
├── .nojekyll                        # Não processar pastas pelo Jekyll
├── .github/workflows/pages.yml      # Publicação automática, sem build
├── src/                             # Código do jogo/site
│   ├── main.js                      # Escritório, monitor, noite, HUD, entradas
│   ├── movement.js                  # Grafo, movimentação e estados visuais da IA
│   ├── map.js                       # Mapa clicável da planta real
│   ├── sound.js                     # Efeitos sonoros gerados no navegador
│   ├── data/game-data.js            # Dados da planta usados no jogo
│   └── styles/main.css              # Interface e animações
├── public/                          # Recursos consumidos pelo navegador
│   ├── images/
│   │   ├── office/                  # Mestre, fundos e camadas de personagens
│   │   │   └── closet/              # Visão pelas frestas e fundo do armário
│   │   ├── menu/                    # Arte da tela de título e variações de glitch
│   │   ├── jumpscares/              # GIFs de susto por personagem e variação
│   │   ├── cameras/
│   │   │   └── CAM01/ … CAM12/      # Uma pasta por câmera
│   │   │       ├── base.webp        # Fundo usado pelo jogo
│   │   │       ├── master.png       # PNG mestre do fundo
│   │   │       ├── technical.png    # Imagem de fallback da planta
│   │   │       └── states/          # WebPs de personagens e portões
│   │   └── branding/                # Ícone do site
│   ├── audio/                       # Trilha do menu e grito dos jumpscares
│   ├── reference/
│   │   └── maps/                    # Imagens da planta V7/V8
│   └── models/                      # Reserva para futuros modelos 3D
└── outros/                          # Arquivos de produção e documentação
    ├── arte/                        # Referências PNG por câmera e artes individuais
    ├── documentacao/               # V8, checklist, manifesto e hashes
    ├── identidade_visual/          # Bíblia visual, paleta e materiais
    ├── planta/                     # Fonte técnica em JSON/Python/SVG
    └── prompts/                     # Prompt mestre + 12 prompts de câmera
```

O arquivo `outros/documentacao/MAPEAMENTO_ORIGINAIS.json` registra a importação dos **60 arquivos originais** do ZIP V8, com os caminhos e hashes SHA-256 da época.

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

- **No menu inicial:** selecione **New Game** para iniciar a noite no escritório.
- **Mouse nas bordas esquerda/direita** ou **A/D e ←/→** no escritório: olhar para os lados.
- **Toque e arraste** no escritório em telas touch: deslocar o panorama.
- **Clique no monitor da mesa**, clique na aba inferior ou pressione **Espaço/M**: abrir/fechar as câmeras.
- **Na tela de câmeras:** clique em uma das 12 câmeras na planta ou use as setas **←/→**.
- **Portões no mapa:** clique para alternar entre aberto (amarelo) e fechado (vermelho). Ao fechar um quarto portão, o último que havia sido fechado abre automaticamente. Os portões voltam a abrir ao reiniciar o turno.
- **F no escritório:** alterna a luz circular no corredor quando o G01 está aberto e a sala está vazia. Uma personagem na porta lateral permite usar a luz. Ao abrir o monitor ou trocar de janela, a luz desliga.
- **Armário técnico:** vire para a direita no escritório e clique na porta. Lá dentro, use as bordas da tela, **A/D**, **←/→** ou um gesto horizontal para alternar entre a porta e o fundo escuro. Pressione **W** (ou toque em **Lanterna**) para iluminar o fundo. Para sair, vire para as frestas e clique na porta.
- Pressione **J** para testar um susto aleatório fora do armário, incluindo o ataque da palhaça pela direita no escritório. Dentro do armário, **J** dispara o ataque dela por baixo, no breu.
- **G01 no mapa:** abre/fecha o portão principal do escritório. O estado acompanha também a reabertura automática pelo limite de três fechados.
- **Esc:** abaixa o monitor.
- O contador de horas vai de 12 AM a 6 AM; ao terminar, é possível reiniciar. As cinco animatrônicas têm posições e temporizadores próprios para o teste visual.

## Teste visual de movimentação

Abra `index.html?debug=1` para ver a posição, a câmera, a contagem até a próxima tentativa, a última sala, o destino e os bloqueios de cada Nathzinha. O painel também mostra o estado selecionado da câmera. As transições e os bloqueios de arte aparecem no console.

Padrão, Yandere e Gótica começam no salão, no estado `todas` da CAM03 e no estado `original-yandere-gotica` da CAM04. A Maid começa na CAM09 com `01-maid-sentada.webp`. A segunda arte da CAM09 retrata a Maid junto a uma porta e fica reservada para uma eventual fase de saída. A Gatinha usa o identificador `platinada` e começa em `nathzinha`, a sala própria sem câmera.

Cada personagem espera de 10 a 14 segundos de aba visível entre movimentos. Observar uma câmera congela as saídas da sala que ela mostra. CAM03 e CAM04 compartilham a mesma sala. Ao voltar de uma aba oculta, o jogo retoma os temporizadores de onde pararam. O fim da noite para a simulação e o reinício restaura as posições, os portões e as contagens.

O escritório recebe personagens pela P02, a partir do estoque. A fila espera no estoque e libera uma personagem por vez para a porta lateral. Ela espera pelo intervalo de movimento antes de ocupar uma das três vagas da sala e, após outro intervalo, pode sair pela mesma passagem. A G01 e a P05 fazem parte da planta, mas as imagens da porta lateral representam somente a P02.

As funções públicas `NathGame.setCam…State` e `NathGame.setOfficeCharacterState` continuam disponíveis para prévias de arte. A próxima mudança de ocupação da sala afetada ou o reinício restaura a representação automática.

### Conexões físicas

O jogo encontra as salas dos dois lados do ponto médio de cada abertura usando os polígonos de `VENUE.rooms` e as coordenadas de `VENUE.openings`. As ligações são bidirecionais. O grafo contém 25 passagens internas. Os portões `G` dependem do estado do mapa e as passagens `P` são livres. As três saídas externas ficam fora do grafo.

| Portão | Salas | Passagem livre | Salas |
|---|---|---|---|
| G01 | Controle ↔ corredor de serviço | P01 | Loja ↔ recepção |
| G02 | Corredor de serviço ↔ VIP 2 | P02 | Estoque ↔ controle |
| G03 | VIP 2 ↔ salão | P03 | Estoque ↔ corredor de serviço |
| G04 | Corredor de serviço ↔ VIP 1 | P04 | Serviço ↔ corredor de serviço |
| G05 | VIP 1 ↔ salão | P05 | Controle ↔ armário |
| G06 | Salão ↔ corredor de serviço | P06 | Serviço ↔ cozinha |
| G07 | Salão ↔ circulação dos banheiros | P07, P08 | Cozinha ↔ corredor de serviço |
| G08 | Recepção ↔ salão | P09 | Cozinha ↔ retirada |
| G09 | Loja ↔ estoque | P10 | Corredor de serviço ↔ retirada |
| | | P11 | Corredor de serviço ↔ sala da Nathzinha |
| | | P12 | Corredor de serviço ↔ elétrica |
| | | P13 | Corredor de serviço ↔ WC funcionários |
| | | P14 | Fliperama ↔ circulação dos banheiros |
| | | P15, P16 | Circulação ↔ WC masculino e feminino, respectivamente |

### Compatibilidade e alcance

| Nathzinha | Câmeras com arte cadastrada | Câmeras alcançáveis a partir da posição inicial |
|---|---|---|
| Padrão, Yandere e Gótica | CAM01–CAM08, CAM10–CAM12 | CAM01–CAM06, CAM08, CAM10–CAM12 |
| Maid | CAM05, CAM06, CAM09, CAM10, CAM11 | CAM09, CAM10, CAM11 |
| Gatinha (`platinada`) | CAM01, CAM02, CAM04, CAM06, CAM07, CAM08 | Nenhuma |

- A CAM09 tem arte para a Maid sozinha. Faltam estados das demais personagens e combinações com elas.
- A CAM12 tem arte apenas para Padrão, Yandere e Gótica. Sem estados de Maid, ela fica no circuito entre serviço, cozinha e retirada. Sem estados de Gatinha, a P11 não oferece um destino representável para ela.
- A CAM03 não tem a Gatinha. A arte dela na CAM04 por si só não cobre os dois ângulos do salão.
- O acesso ao fliperama passa pela circulação dos banheiros, que não tem representação visual. A CAM07 tem arte, mas fica fora das rotas atuais.
- Para autorizar um movimento, o jogo exige a combinação exata em cada câmera do destino, a combinação restante na origem e todas as variantes de portão que podem ser selecionadas. O navegador verifica o carregamento dos arquivos antes de permitir a transição.

## Câmeras e imagens disponíveis

| ID | Sala da planta | Recurso exibido |
|---|---|---|
| CAM01 | Lojinha | Loja vazia e quinze variantes com as Nathzinhas |
| CAM02 | Recepção | Recepção vazia e quinze variantes com as Nathzinhas |
| CAM03 | Salão principal, virada para o palco | 27 combinações entre palco e salão, incluindo a cena vazia |
| CAM04 | Salão principal, parede oposta | 32 combinações de personagens e portão G08 |
| CAM05 | VIP 1 rosa | 64 combinações de personagens e portões G04/G05 |
| CAM06 | VIP 2 lavanda | Sala vazia e 31 variantes com as Nathzinhas |
| CAM07 | Fliperama | Sala vazia e quinze variantes com as Nathzinhas |
| CAM08 | Estoque | Novo estoque vazio e quinze variantes com as Nathzinhas |
| CAM09 | Área de serviço | Área de manutenção vazia e Maid sentada |
| CAM10 | Cozinha | Cozinha vazia sem HUD na arte e quinze variantes com as Nathzinhas |
| CAM11 | Área de retirada | Balcão vazio e quinze variantes com as Nathzinhas |
| CAM12 | Corredor de serviço, leste | 16 combinações de personagens e portão G06 |

Cada câmera reúne o fundo, o PNG mestre e a planta técnica em `public/images/cameras/CAMxx/`. As variantes ficam em `states/` com o nome da combinação, por exemplo `CAM01/states/original-platinada.webp`. Nas câmeras com portões, uma subpasta indica a posição dos portões, como `CAM04/states/open/` ou `CAM05/states/open-closed/`. Nessas subpastas, `vazia.webp` é a sala sem personagens. O fundo fechado padrão fica em `base.webp`.

O jogo pode selecionar a variante da loja com `NathGame.setCam01ShopState('original-platinada')` e a da recepção com `NathGame.setCam02ReceptionState('original-platinada')`. Use `todas` para mostrar as quatro e `vazia` para restaurar a sala vazia.

Na CAM03, a Padrão, a Yandere e a Gótica têm uma pose no palco e outra no salão. As 19 imagens com alguém fora do palco usam nomes como `palco-original--salao-yandere-gotica.webp`. Para conferir uma delas no jogo, use `NathGame.setCam03StageState('palco-original--salao-yandere-gotica')`.

Na CAM04, o portão à esquerda acompanha o G08, entre a recepção e a parede sul do salão. Cada posição do portão tem 16 combinações de personagens sobre a nova base. Selecione uma com `NathGame.setCam04HallState('gotica-platinada')`, `todas` ou `vazia`. A câmera começa com o portão aberto e mantém as personagens selecionadas ao alterná-lo. Veja `outros/prompts/CAM04_ESTADOS_PORTAO.md`.

A CAM05 começa com os dois portões abertos, mostrando breu nas aberturas. G04 controla o portão esquerdo e G05, o direito. Cada configuração dos portões tem 16 combinações de personagens. Selecione uma com `NathGame.setCam05VipState('original-maid')`, `todas` ou `vazia`. A troca de portões mantém as personagens selecionadas, inclusive em reaberturas automáticas. Os recortes da Padrão e da Yandere incluem ajustes nas cadeiras conforme a referência ocupada. Os quatro fundos vazios estão documentados em `outros/prompts/CAM05_ESTADOS_PORTOES.md`.

A CAM06 usa o mesmo fundo para as 32 combinações de personagens. Selecione uma com `NathGame.setCam06VipState('original-platinada-maid')`, `todas` ou `vazia`. A cadeira da Padrão acompanha a posição em que ela aparece sentada na referência.

A CAM07 tem 16 combinações com a Padrão, a Yandere, a Gótica e a Platinada. Selecione uma com `NathGame.setCam07ArcadeState('gotica-platinada')`, `todas` ou `vazia`.

A CAM08 usa a nova imagem do estoque, guardada como `CAM08/master.png`, para as 16 combinações com a Padrão, a Yandere, a Gótica e a Platinada. Selecione uma com `NathGame.setCam08StockroomState('gotica-platinada')`, `todas` ou `vazia`.

A CAM10 usa a nova arte da cozinha sem HUD como base para as 16 combinações da Padrão, da Yandere, da Gótica e da Maid preto e branco. Selecione uma com `NathGame.setCam10KitchenState('yandere-maid')`, `todas` ou `vazia`.

A CAM11 tem 16 combinações com a Padrão, a Yandere, a Gótica e a Maid preto e branco. O cabelo vermelho na borda esquerda identifica a Yandere. Selecione uma combinação com `NathGame.setCam11PickupState('yandere-maid')`, `todas` ou `vazia`.

Na CAM12, o portão hidráulico G06 começa aberto e revela as cortinas vermelhas dos bastidores do palco da CAM03. Clique no G06 ao norte do salão para baixar ou levantar o portão.

Cada estado do G06 tem oito combinações com a Padrão, a Yandere ao fundo e a Gótica. Selecione uma com `NathGame.setCam12CorridorState('original-gotica')`, `todas` ou `vazia`. A seleção permanece ao alternar o portão.

O comando `node tests/camera-gates.cjs` testa a integração do movimento, dos portões, da luz e das camadas do escritório. O comando `node tests/movement.cjs` confere o grafo, os temporizadores, as combinações e os arquivos de imagem. Os comandos `python tests/test_cam05_images.py` e `python tests/test_office_images.py` (Pillow) conferem a consistência dos cenários.

Os três estados da nova sala de controle estão em `public/images/office/states/`. O PNG mestre é a arte nova, e a área clicável acompanha o monitor à esquerda da mesa. Prompts e composição: `outros/prompts/ESCRITORIO_ESTADOS_PORTAO.md`.

O escritório aceita até três animatrônicas na sala e uma diferente na porta lateral. As camadas de `public/images/office/characters/` compõem 101 combinações com o portão principal aberto no escuro, 101 com ele fechado e seis com o corredor iluminado e a sala vazia. Use `NathGame.setOfficeCharacterState([], 'yandere')` e pressione **F** para ver a Yandere na porta lateral com o corredor iluminado. Chame a função sem argumentos para esvaziar a cena. Para exportar os 208 panoramas em WebP, rode `python scripts/export_office_states.py <pasta-de-destino>` com Pillow. Acrescente `--lit-only` para exportar apenas os seis iluminados.

Os 111 panoramas com as poses do corredor ficam em `public/images/office/states/corridor/`. O `manifest.json` lista os arquivos, os ocupantes da porta e do corredor e a ordem dos slots para cada quantidade. Para exportá-los novamente, rode `python scripts/export_office_corridor.py outros/arte/office/corridor-lineup.png` com Pillow.

Pelas frestas do armário, a cena acompanha as personagens do escritório e o G01. As 172 imagens em `public/images/office/closet/states/` cobrem de zero a três Nathzinhas na sala e até uma diferente na porta lateral. A Maid só aparece na sala e a Palhaça fica fora dessas combinações. Use `NathGame.setOfficeCharacterState(['original', 'gotica'], 'yandere')` para testar a Padrão e a Gótica na sala com a Yandere na porta. Para recriar as imagens a partir das artes de referência, rode `python -B scripts/export_closet_states.py` com Pillow.

O mapa da interface usa os **polígonos das salas, aberturas, posições e azimutes das 12 câmeras** em `src/data/game-data.js`. Na parede norte do salão, o G06 ocupa o trecho da antiga passagem azul P17, atrás do palco. As plantas técnicas V8 registram o layout original.

## Observações

- As referências com personagens ficam em `outros/arte/cameras/CAMxx/` e as artes individuais em `outros/arte/animatronics/`. As máscaras do palco e os recortes do salão ficam em `outros/arte/cameras/CAM03/`. Use `python scripts/compose_cam03.py` para recompor as seis variantes parciais do palco e `python scripts/compose_cam03.py --salao` para exportar as 19 cenas com personagens fora do palco.
- O pacote V8 não incluía arquivos 3D `.glb`/`.gltf`; `public/models/` foi preparado sem modelos inventados.
- Os efeitos de som são sintetizados localmente pelo navegador e começam após o primeiro clique ou tecla, conforme as regras do navegador.
- A sala do escritório é uma **imagem panorâmica pré-renderizada**, não um cenário 3D em tempo real.
- A IA desta versão circula pelo restaurante para testar a representação visual das posições.
