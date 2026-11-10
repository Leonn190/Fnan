# Nine Nights at Nath's — Sistema de jogo v1.1.2 🌸

Fangame de terror com um turno de 12 AM a 6 AM. **New Game** inicia todas as Nathzinhas no nível 0. **Custom Night** permite escolher o nível de cada uma das seis, inclusive a Palhaça, de 0 a 9. Cada hora dura 60 segundos reais e a vitória ocorre aos 360 segundos. A mesma noite pode ser repetida após vitória ou derrota.

**Projeto estático puro:** HTML + CSS + JavaScript com scripts locais. Não depende de Node.js, npm, Vite, Astro, bundlers, servidores próprios, banco de dados ou etapa de build. Desenvolvido para hospedar diretamente no **GitHub Pages**.

## Estrutura

```text
Restaurante_da_Nathzinha_Web_V1/
├── index.html                       # Menu inicial e tela da noite
├── .nojekyll                        # Não processar pastas pelo Jekyll
├── .github/workflows/pages.yml      # Publicação automática, sem build
├── config/                          # Regras carregadas pelo jogo em tempo de execução
├── src/                             # Código do jogo/site
│   ├── main.js                      # Escritório, monitor, noite, HUD, entradas
│   ├── config.js                    # Leitura dos JSONs por HTTP(S)
│   ├── movement.js                  # Relógio, tentativas, ocupação e transições
│   ├── gameplay/                    # Grafo, pesos, ataques, Palhaça e sabotagem
│   ├── night-menu.js                # Menu e seletores do Custom Night
│   ├── scene-art.js                 # Seleção das variantes e dos slots visuais
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

Abra `index.html` diretamente para jogar com a configuração padrão incluída. Para testar alterações locais nos JSONs, use **Carregar pasta config** na tela de entrada e selecione a pasta `config/` antes de clicar em **Jogar**.

Em HTTP(S), inclusive no GitHub Pages, o jogo carrega `config/` diretamente. Para testar assim no computador, execute `python -m http.server 8000` na raiz e abra [localhost:8000](http://localhost:8000/). Recarregue a página após editar um JSON.

Ao alterar os padrões que serão distribuídos para abertura direta, atualize a cópia local com `node scripts/sync-local-config.cjs`. Confira a sincronização com `node scripts/sync-local-config.cjs --check`. Abrir o jogo e publicar no Pages dispensam essa etapa.

A área do jogo tem largura máxima de 16:9, centralizada sobre fundo preto. Monitores ultrawide, incluindo modelos curvos, recebem bordas pretas nas laterais: escritório, câmeras, mapa e HUD usam a mesma área útil. A curvatura física não é detectável pelo navegador; a proporção da tela define as bordas. O movimento do panorama usa as bordas da área do jogo.

## Como jogar

- Clique no monitor para abrir o computador. Abra **Câmeras** para selecionar uma das doze na planta ou com **←/→**. **Esc** fecha a janela ativa e volta do computador ao escritório.
- No escritório, use as bordas do panorama, **A/D**, **←/→** ou arraste no touch. Olhar para a porta esquerda impede travessias na aproximação. **Q** ou **Porta esquerda** fecha e abre o acesso lateral.
- **F** ou **Lanterna** ilumina o corredor quando o G01 está aberto e a sala está vazia. A luz impede movimentos pelo corredor enquanto apontada para ele e afeta os pesos de Gótica, Yandere e Gatinha. A planta controla o G01, G02 e G06. O limite de três portões fechados no mapa preserva a reabertura automática do último a ter sido fechado.
- Use o botão **Reproduzir som nesta câmera** para atrair ou repelir personagens. O som dura 7 s na câmera de origem, inclusive depois de mudar de câmera, com recarga de 12 s desde o acionamento.
- Se houver uma invasão, vire para a direita e clique na porta do armário técnico dentro do prazo. A proteção começa no clique. Espere as invasoras saírem antes de voltar ao escritório. Dentro do armário, vire para o fundo com as bordas, **A/D**, **←/→** ou gesto horizontal. **W** ou **Lanterna** ilumina a Palhaça e congela seu contador. Vire para as frestas para sair.
- O botão redondo do rádio toca uma das três faixas e reduz o contador da Palhaça. Cada entrada no armário registra um possível piso. O piso passa a valer se o contador cruzar o limiar para cima após o registro. O rádio, o computador, o movimento da visão, a porta lateral e as viagens ao armário contribuem para o barulho.
- Abra `?debug=1` para acompanhar posições, dificuldades, bloqueios, contadores e o estado da câmera. Nesse modo, **J** testa os sustos.

## Configuração

| Arquivo | Regras e dados |
|---|---|
| `night.json` | Horário inicial, duração, vitória e faixa de dificuldade |
| `map.json` | 25 posições, 36 ligações, câmeras, capacidade e arestas de portões |
| `characters.json` | Posições permitidas, partida, IA, rastreamento, reação e habilidades individuais |
| `movement.json` | Sorteio, variação dos intervalos, efeitos dos níveis, bloqueios e recuo |
| `effects.json` | Alcance e recarga do áudio, estática, lanterna, fontes e dissipação do barulho |
| `threats.json` | Permanência, contador e estágios da Palhaça, distribuição e prazo de sabotagem |
| `controls.json` | Integração com os controles, transições, localização e recursos audiovisuais |

O grafo lógico funciona independentemente da planta desenhada e da disponibilidade de arte. Um destino atrás de portão fechado entra no sorteio. Ao ser bloqueada, a tentativa mantém o destino por até 3 s. Se o impedimento continuar, o próximo intervalo usa metade do tempo normal sorteado. A Gótica pode causar estática compartilhada. A Padrão pode abrir portões físicos e é a única que percorre as saídas externas. A Maid avança os estágios iniciais usando seu próprio relógio e sai de Serviço uma única vez. A Gatinha usa três esconderijos fora das câmeras.

O G06 controla 2↔19. O G02 controla 7↔14 e 25↔14. O G01 existente controla 14↔13. O controle lateral **Q** opera 12↔13 e representa a porta da oficina para o evento de barulho. O retorno especial desloca diretamente para o destino sorteado. Quando já há uma invasora no escritório, a próxima que chegaria à porta esquerda pode entrar diretamente, sujeita aos bloqueios aplicáveis.

O temporizador de permanência de cada invasora conta desde a entrada dela no controle. O clique no armário decide se a permanência usa o tempo normal ou tardio. Em caso de eventos simultâneos, as ações registradas do jogador precedem a resolução das tentativas e dos ataques. O relógio usa tempo real transcorrido, inclusive com a aba oculta.

### Pendências da especificação e da arte

- **Sanidade** tem configuração `null`. A especificação não define medidor, taxas ou efeito.
- **P04** deixa o teto do barulho em `null`. O acúmulo segue as taxas confirmadas e o peso não fica negativo.
- **P06** define a roleta de sabotagens e a morte após 25 s de ventilação sabotada. Faltam o procedimento de conserto, as durações e os efeitos técnicos de câmeras, portas e áudio. O Painel Geral sinaliza as falhas sorteadas. Os reinícios manuais já existentes no painel continuam separados da sabotagem.
- **P08** deixa os demais vínculos entre portões e arestas pendentes. Os controles e as variantes visuais existentes desses portões continuam disponíveis.
- **P11** mantém em aberto limites gerais de acúmulo e um piso quantitativo para os pesos. O teto de magnitude da lanterna e os empates seguem as regras confirmadas.
- As posições 8 e 11 ainda aguardam retratos próprios. As demais posições sem câmera continuam fora dos feeds.

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
| CAM09 | Área de serviço | Área de manutenção vazia, Maid sentada e Maid junto à saída |
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

O comando `node tests/camera-gates.cjs` testa os controles, a interface, os portões, a luz e as camadas do escritório. O comando `node tests/movement.cjs` testa as regras, o relógio e os efeitos usando os JSONs reais. Os comandos `python tests/test_cam05_images.py` e `python tests/test_office_images.py` (Pillow) conferem a consistência dos cenários.

Os três estados da nova sala de controle estão em `public/images/office/states/`. O PNG mestre é a arte nova, e a área clicável acompanha o monitor à esquerda da mesa. Prompts e composição: `outros/prompts/ESCRITORIO_ESTADOS_PORTAO.md`.

O escritório compõe as camadas das invasoras e da ocupante da porta lateral. As camadas de `public/images/office/characters/` compõem 101 combinações com o portão principal aberto no escuro, 101 com ele fechado e seis com o corredor iluminado e a sala vazia. Use `NathGame.setOfficeCharacterState([], 'yandere')` e pressione **F** para ver a Yandere na porta lateral com o corredor iluminado. Chame a função sem argumentos para esvaziar a cena. Para exportar os 208 panoramas em WebP, rode `python scripts/export_office_states.py <pasta-de-destino>` com Pillow. Acrescente `--lit-only` para exportar apenas os seis iluminados.

As poses iluminadas do corredor usam `public/images/office/states/corridor-atlas.webp`, composto a partir dos recortes originais. Para reproduzir o atlas, rode `python -B scripts/export_office_corridor.py outros/arte/office/corridor-lineup.png --atlas public/images/office/states/corridor-atlas.webp` com Pillow.

Pelas frestas do armário, a cena acompanha as personagens do escritório e o G01. As 172 imagens em `public/images/office/closet/states/` cobrem de zero a três Nathzinhas na sala e até uma diferente na porta lateral. Camadas derivadas da arte original completam as frestas quando há quatro ou cinco invasoras. A Maid só aparece na sala e a Palhaça fica fora dessas combinações. Use `NathGame.setOfficeCharacterState(['original', 'gotica'], 'yandere')` para testar a Padrão e a Gótica na sala com a Yandere na porta. Para recriar as imagens a partir das artes de referência, rode `python -B scripts/export_closet_states.py` com Pillow. Para gerar as duas camadas adicionais, use `python -B scripts/export_closet_states.py public/images/office/closet/layers --overflow-layers`.

O mapa da interface usa os **polígonos das salas, aberturas, posições e azimutes das 12 câmeras** em `src/data/game-data.js`. Na parede norte do salão, o G06 ocupa o trecho da antiga passagem azul P17, atrás do palco. As plantas técnicas V8 registram o layout original.

## Observações

- As referências com personagens ficam em `outros/arte/cameras/CAMxx/` e as artes individuais em `outros/arte/animatronics/`. As máscaras do palco e os recortes do salão ficam em `outros/arte/cameras/CAM03/`. Use `python scripts/compose_cam03.py` para recompor as seis variantes parciais do palco e `python scripts/compose_cam03.py --salao` para exportar as 19 cenas com personagens fora do palco.
- O pacote V8 não incluía arquivos 3D `.glb`/`.gltf`; `public/models/` foi preparado sem modelos inventados.
- Os efeitos de som são sintetizados localmente pelo navegador e começam após o primeiro clique ou tecla, conforme as regras do navegador.
- A sala do escritório é uma **imagem panorâmica pré-renderizada**, não um cenário 3D em tempo real.
