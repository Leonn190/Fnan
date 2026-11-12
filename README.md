# Nine Nights at Nath's — Sistema de jogo v1.1.2 🌸

Fangame de terror com uma campanha de nove noites. **New Game** começa na Noite 1 com Gótica e Yandere. Cada vitória desbloqueia a próxima noite e o menu guarda o progresso neste navegador. Os turnos começam às 12 AM e terminam às 6 AM, com a Noite 9 indo até as 7 AM. A energia começa a ser consumida na Noite 3 e a sanidade entra na Noite 4. Cada hora dura 50 segundos na Noite 1, 55 na Noite 2 e 60 a partir da Noite 3. Na Custom Night, a sanidade faz cada hora durar entre 60 e 240 segundos.

Os contadores de movimento começam após a pausa inicial de cada noite. A pausa dura 40 s nas noites 1 e 2, 30 s na 3, 25 s na 4, 20 s nas noites 5 e 6, 15 s na 7 e 12 s nas noites 8 e 9.

**Custom Night** tem seis horas e permite escolher o nível de 0 a 10 para cada personagem. Na campanha e na Custom Night, animatrônicas de nível 0 ficam imóveis e suas habilidades ficam desativadas. A Palhaça dorme no armário, Smores fica sobre a mesa do escritório e Shadow fica ao fundo da CAM12. As outras aparecem nas câmeras de suas posições iniciais. O turno pode ser repetido após vitória ou derrota.

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
│   ├── gameplay/                    # Grafo, efeitos, ameaças, recursos e Shadow
│   ├── night-menu.js                # Menu e seletores do Custom Night
│   ├── scene-art.js                 # Seleção das variantes e dos slots visuais
│   ├── map.js                       # Mapa clicável da planta real
│   ├── sound.js                     # Efeitos sonoros gerados no navegador
│   ├── data/game-data.js            # Dados da planta usados no jogo
│   └── styles/main.css              # Interface e animações
├── public/                          # Recursos consumidos pelo navegador
│   ├── images/
│   │   ├── office/                  # Mestre, fundos e camadas de personagens
│   │   │   └── closet/              # Frestas, camadas e poses da Palhaça
│   │   ├── computer/                # Moldura do monitor e papel de parede
│   │   ├── shadow/                  # Confronto Neon e sprite das câmeras
│   │   ├── menu/                    # Arte da tela de título e variações de glitch
│   │   ├── jumpscares/              # GIFs por personagem e WebP animado da Shadow
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
    ├── arte/                        # Referências, PNGs de origem e quadros da Shadow
    ├── audio/                       # Áudio original do rádio
    ├── documentacao/               # V8, checklist, manifesto e hashes
    ├── identidade_visual/          # Bíblia visual, paleta e materiais
    ├── planta/                     # Fonte técnica em JSON/Python/SVG
    └── prompts/                     # Prompt mestre + 12 prompts de câmera
```

O arquivo `outros/documentacao/MAPEAMENTO_ORIGINAIS.json` registra a importação dos **60 arquivos originais** do ZIP V8, com os caminhos e hashes SHA-256 da época.

As imagens do menu, do computador, da Shadow e da Palhaça usam WebP sem perdas. Os PNGs correspondentes ficam em `outros/arte/`, com a mesma estrutura e extensão `.png`. O arquivo `outros/arte/shadow/jumpscare-frames.zip` guarda os 48 quadros e a animação usada em `public/images/jumpscares/shadow.webp`. As faixas de `public/audio/radio/` são as versões usadas pelo jogo, com as gravações de origem em `outros/audio/radio/`.

## Publicar no GitHub Pages (sem build)

1. Crie um repositório no GitHub e coloque **o conteúdo desta pasta** na raiz da branch `main`. `index.html` deve ficar na raiz, não dentro de outra pasta.
2. Em **Settings → Pages → Build and deployment**, escolha **GitHub Actions** como fonte.
3. O workflow `.github/workflows/pages.yml` publicará os arquivos estáticos do repositório automaticamente. Nenhum `npm install`, `npm run build` ou build local é necessário.
4. Acesse a URL indicada em **Settings → Pages**, normalmente `https://seu-usuario.github.io/nome-do-repo/`.

Também funciona com a opção clássica **Deploy from a branch → main → /(root)** em repositórios que permitam essa modalidade. Os endereços são relativos (`./public/...`, `./src/...`) e funcionam tanto no site de projeto quanto no site de usuário.

## Testar localmente e enquadramento

Abra `index.html` diretamente para jogar com a cópia local gerada a partir de `config/`.

Em HTTP(S), inclusive no GitHub Pages, o jogo carrega `config/` diretamente. Para testar assim no computador, execute `python -m http.server 8000` na raiz e abra [localhost:8000](http://localhost:8000/). Recarregue a página após editar um JSON.

Ao alterar os JSONs, rode `node scripts/sync-local-config.cjs` para atualizar a cópia usada por `file://` e o mapa de referência `NNN_mapa_posicoes_22.json`. Confira ambos com `node scripts/sync-local-config.cjs --check`. Abrir o jogo e publicar no Pages dispensam essa etapa.

Execute `node tests/night-systems.cjs`, `node tests/movement.cjs` e `node tests/camera-gates.cjs` para validar as regras e os controles. Execute `node tests/image-cache.cjs` para conferir o cache. Os testes de arte `tests/test_cam05_images.py` e `tests/test_office_images.py` rodam diretamente com Python e Pillow.

A área do jogo tem largura máxima de 16:9, centralizada sobre fundo preto. Monitores ultrawide, incluindo modelos curvos, recebem bordas pretas nas laterais: escritório, câmeras, mapa e HUD usam a mesma área útil. A curvatura física não é detectável pelo navegador; a proporção da tela define as bordas. O movimento do panorama usa as bordas da área do jogo.

## Como jogar

- Pressione **S** ou clique no monitor para abrir o computador. Em **Câmeras**, selecione uma das doze câmeras na planta. Clique fora da tela do monitor para voltar ao escritório. O botão ⏻ no monitor liga e desliga o computador. O menu Iniciar também permite desligá-lo.
- No escritório, pressione **A** ou **D** para ir até a extremidade esquerda ou direita. Também é possível usar as bordas do panorama ou arrastar no touch. A porta esquerda fica sempre aberta. Olhar para ela impede travessias na aproximação.
- Clique no botão rosa à direita do portão principal para fechar ou abrir o G01. Segure **W** ou pressione e segure no breu do portão para iluminar o corredor quando ele está aberto e a sala está vazia. A luz impede movimentos pelo corredor enquanto apontada para ele e afeta os pesos de Gótica, Yandere e Gatinha. A planta também controla o G01. O limite de portões fechados começa em zero na Noite 1 e aumenta em um por noite. Na Custom Night, o limite é três. Ao fechar outro portão no limite, o último que foi fechado reabre.
- Use o botão **Reproduzir som nesta câmera** para atrair ou repelir personagens. O som dura 7 s na câmera de origem, inclusive depois de mudar de câmera, com recarga de 12 s desde o acionamento.
- Se houver uma invasão, vire para a direita e clique na porta do armário técnico dentro do prazo. A proteção começa no clique. Espere as invasoras saírem antes de voltar ao escritório. No armário, pressione **D** para olhar o fundo ou **A** para voltar às frestas. As bordas da visão e o gesto horizontal também viram a câmera. Segure **W** ou pressione e segure sobre a Palhaça para iluminá-la e congelar seu contador. Clique nas frestas para sair.
- O botão redondo do rádio toca uma das três faixas e reduz o contador da Palhaça. Cada entrada no armário registra um possível piso. O piso passa a valer se o contador cruzar o limiar para cima após o registro. O rádio, o computador, o movimento da visão e as viagens ao armário contribuem para o barulho.
- Observe as barras no canto inferior esquerdo. Ver animatrônicas, ficar no armário e fechar o portão central reduzem a sanidade. A música ajuda a recuperá-la. Sanidade baixa favorece a Shadow e desacelera o relógio na Custom Night.
- Ao ver **FIND ME**, abra as câmeras e encontre a Shadow antes do fim do prazo. Ela escolhe uma câmera por aparição e só pode se manifestar no retorno ao escritório.
- Ao entrar na elétrica, a Yandere derruba os feeds e bloqueia os controles dos nove portões. Cada portão mantém sua posição física no momento da falha, e a Padrão ainda pode abri-lo. Quando a tela mostrar **SEM SINAL**, desligue o computador pelo botão ⏻ e volte a ligá-lo pelo botão de energia no escritório. O rádio, a lanterna e o armário continuam disponíveis conforme suas próprias regras. O prazo de busca da Shadow pausa enquanto as câmeras estão indisponíveis.
- O computador ligado e os portões fechados consomem energia. No apagão, o computador para, o rádio ainda pode funcionar por 25 s e as perdas de sanidade dobram. O armário e a lanterna continuam disponíveis.
- Abra `?debug=1` para acompanhar posições, dificuldades, bloqueios, contadores e o estado da câmera. Nesse modo, **J** testa os sustos.

## Configuração

| Arquivo | Regras e dados |
|---|---|
| `night.json` | Horário inicial, relógio, duração, recursos e níveis da campanha, além dos padrões da Custom Night |
| `sanity.json` | Perdas, recuperação e multiplicador do apagão |
| `power.json` | Energia inicial, consumo, aviso e prazo do rádio |
| `shadow.json` | Dificuldade, chance, prazos e recursos visuais da Shadow |
| `map.json` | 26 posições, 35 ligações físicas, câmeras, capacidades e aberturas da planta |
| `characters.json` | Posições permitidas, partida, IA, reação e habilidades individuais |
| `movement.json` | Sorteio, variação dos intervalos, efeitos dos níveis, bloqueios e recuo |
| `effects.json` | Alcance e recarga do áudio, estática, lanterna, fontes e dissipação do barulho |
| `threats.json` | Permanência no escritório, Palhaça, Smores e posição da elétrica |
| `controls.json` | Controles, transições e recursos audiovisuais |

As posições têm sala e coordenadas na planta. Cada ligação em `config/map.json` representa circulação interna, passagem livre, portão ou saída externa. As 35 ligações atuais funcionam nos dois sentidos. A IA usa as passagens abertas para ponderar a distância até seu alvo. A permanência tem metade do peso base de uma ligação vizinha e uma porta fechada ainda pode ser tentada. A tentativa aguarda até 3 s. Se falhar, o próximo intervalo usa metade do valor aplicável, com a retenção configurada dos modificadores.

### Portões e circulação

| Portão | Passagem | Posições |
|---|---|---|
| G01 | Escritório e corredor central | 14 ↔ 13 |
| G02 | Entrada oeste da VIP 2 | 7 ↔ 14 |
| G03 | Entrada leste da VIP 2 | 2 ↔ 7 e 3 ↔ 7 |
| G04 | Entrada oeste da VIP 1 | 6 ↔ 15 |
| G05 | Entrada leste da VIP 1 | 2 ↔ 6 |
| G06 | Bastidores do palco e corredor da CAM12 | 2 ↔ 19 |
| G07 | Salão e circulação dos banheiros | 3 ↔ 26 |
| G08 | Salão e recepção | 3 ↔ 5 |
| G09 | Lojinha e estoque | 9 ↔ 10 |

A circulação 26 fica fora do enquadramento da CAM07. A passagem P14 liga 26 ao fliperama (4), e P15 liga 26 ao esconderijo 24, no banheiro masculino. Foram removidas as ligações diretas 3 ↔ 4, 3 ↔ 24 e 4 ↔ 24. O esconderijo 25 fica dentro da VIP 2 e se liga a 7. O trajeto até o corredor oeste passa por 7 e G02.

O estoque (10) leva à aproximação da porta esquerda (12), e P02 liga 12 ao escritório (13). Uma invasora no escritório faz quem estiver no estoque esperar antes de ocupar 12. A Maid usa G01 e o corredor central. As saídas externas conectam 8, 11 e 22 pelo perímetro e são exclusivas da Padrão. O acesso à elétrica (21) passa por P12 e é exclusivo da Yandere.

A Padrão tenta abrir o portão quando a observação permite. As chances são 70% e 94%, conforme a habilidade. Após abrir, ela só cruza se as demais condições forem atendidas. A Gótica mantém sua estática temporária. A Maid avança seus estágios iniciais e sai de Serviço uma vez. Recuos percorrem uma ligação por vez com intervalo próprio e respeitam portões, observação e capacidade.

A vantagem avançada da Yandere começa em `movement.difficulty.abilityLevel` (nível 4). O campo `yandere.firstIntervalFactor` vale 0,60 e incide uma vez, após o cálculo do primeiro intervalo. Os intervalos seguintes continuam sujeitos à dificuldade normal. Uma nova entrada na elétrica pode causar outra falha após a recuperação.

O temporizador de permanência de cada invasora conta desde a entrada dela no controle. O clique no armário decide se a permanência usa o tempo normal ou tardio. Em caso de eventos simultâneos, as ações registradas do jogador precedem a resolução das tentativas e dos ataques. O relógio usa tempo real transcorrido, inclusive com a aba oculta.

### Pendências da especificação e da arte

- **P04** deixa o teto do barulho em `null`. O acúmulo segue as taxas confirmadas e o peso não fica negativo.
- **P11** mantém em aberto limites gerais de acúmulo e um piso quantitativo para os pesos. O teto de magnitude da lanterna e os empates seguem as regras confirmadas.
- As posições 8 e 11 ainda aguardam retratos próprios. As demais posições sem câmera continuam fora dos feeds.
- O escritório e as câmeras CAM04, CAM05 e CAM12 têm variantes para G01, G08, G04/G05 e G06, respectivamente. G02, G03, G07 e G09 usam a arte original de cada cena. O mapa mostra a posição física desses quatro portões.

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

O escritório compõe as camadas das invasoras e da ocupante da porta lateral. As camadas de `public/images/office/characters/` compõem 101 combinações com o portão principal aberto no escuro, 101 com ele fechado e seis com o corredor iluminado e a sala vazia. Use `NathGame.setOfficeCharacterState([], 'yandere')` e pressione **W** para ver a Yandere na porta lateral com o corredor iluminado. Chame a função sem argumentos para esvaziar a cena. Para exportar os 208 panoramas em WebP, rode `python scripts/export_office_states.py <pasta-de-destino>` com Pillow. Acrescente `--lit-only` para exportar apenas os seis iluminados.

As poses iluminadas do corredor usam `public/images/office/states/corridor-atlas.webp`, composto a partir dos recortes originais. Para reproduzir o atlas, rode `python -B scripts/export_office_corridor.py outros/arte/office/corridor-lineup.png --atlas public/images/office/states/corridor-atlas.webp` com Pillow.

Pelas frestas do armário, a cena acompanha as personagens do escritório e o G01. As 172 imagens em `public/images/office/closet/states/` cobrem de zero a três Nathzinhas na sala e até uma diferente na porta lateral. Camadas derivadas da arte original completam as frestas quando há quatro ou cinco invasoras. A Maid só aparece na sala e a Palhaça fica fora dessas combinações. Use `NathGame.setOfficeCharacterState(['original', 'gotica'], 'yandere')` para testar a Padrão e a Gótica na sala com a Yandere na porta. Para recriar as imagens a partir das artes de referência, rode `python -B scripts/export_closet_states.py` com Pillow. Para gerar as duas camadas adicionais, use `python -B scripts/export_closet_states.py public/images/office/closet/layers --overflow-layers`.

O mapa da interface usa os **polígonos das salas, aberturas, posições e azimutes das 12 câmeras** em `src/data/game-data.js`. Na parede norte do salão, o G06 ocupa o trecho da antiga passagem azul P17, atrás do palco. As plantas técnicas V8 registram o layout original.

## Observações

- As referências com personagens ficam em `outros/arte/cameras/CAMxx/` e as artes individuais em `outros/arte/animatronics/`. As máscaras do palco e os recortes do salão ficam em `outros/arte/cameras/CAM03/`. Use `python scripts/compose_cam03.py` para recompor as seis variantes parciais do palco e `python scripts/compose_cam03.py --salao` para exportar as 19 cenas com personagens fora do palco.
- O pacote V8 não incluía arquivos 3D `.glb`/`.gltf`; `public/models/` foi preparado sem modelos inventados.
- Os efeitos de som são sintetizados localmente pelo navegador e começam após o primeiro clique ou tecla, conforme as regras do navegador.
- A sala do escritório é uma **imagem panorâmica pré-renderizada**, não um cenário 3D em tempo real.
