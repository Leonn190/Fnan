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
│   ├── data/game-data.js            # Dados da planta usados no jogo
│   └── styles/main.css              # Interface e animações
├── public/                          # Recursos consumidos pelo navegador
│   ├── images/
│   │   ├── office/                  # Mestre, fundos e camadas de personagens
│   │   ├── cameras/
│   │   │   └── CAM01/ … CAM12/      # Uma pasta por câmera
│   │   │       ├── base.webp        # Fundo usado pelo jogo
│   │   │       ├── master.png       # PNG mestre do fundo
│   │   │       ├── technical.png    # Imagem de fallback da planta
│   │   │       └── states/          # WebPs de personagens e portões
│   │   └── branding/                # Ícone do site
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
| CAM01 | Lojinha | Loja vazia e quinze variantes com as Nathzinhas |
| CAM02 | Recepção | Recepção vazia e quinze variantes com as Nathzinhas |
| CAM03 | Salão principal, virada para o palco | Palco vazio e sete variantes com as Nathzinhas |
| CAM04 | Salão principal, parede oposta | 32 combinações de personagens e portão G08 |
| CAM05 | VIP 1 rosa | 64 combinações de personagens e portões G04/G05 |
| CAM06 | VIP 2 lavanda | Sala vazia e 31 variantes com as Nathzinhas |
| CAM07 | Fliperama | Sala vazia e quinze variantes com as Nathzinhas |
| CAM08 | Estoque | Novo estoque vazio e quinze variantes com as Nathzinhas |
| CAM09 | Área de serviço | Nova arte da sala de manutenção técnica |
| CAM10 | Cozinha | Cozinha vazia sem HUD na arte e quinze variantes com as Nathzinhas |
| CAM11 | Área de retirada | Balcão vazio e quinze variantes com as Nathzinhas |
| CAM12 | Corredor de serviço, leste | 16 combinações de personagens e portão G06 |

Cada câmera reúne o fundo, o PNG mestre e a planta técnica em `public/images/cameras/CAMxx/`. As variantes ficam em `states/` com o nome da combinação, por exemplo `CAM01/states/original-platinada.webp`. Nas câmeras com portões, uma subpasta indica a posição dos portões, como `CAM04/states/open/` ou `CAM05/states/open-closed/`. Nessas subpastas, `vazia.webp` é a sala sem personagens. O fundo fechado padrão fica em `base.webp`.

O jogo pode selecionar a variante da loja com `NathGame.setCam01ShopState('original-platinada')` e a da recepção com `NathGame.setCam02ReceptionState('original-platinada')`. Use `todas` para mostrar as quatro e `vazia` para restaurar a sala vazia.

Na CAM04, o portão à esquerda acompanha o G08, entre a recepção e a parede sul do salão. Cada posição do portão tem 16 combinações de personagens sobre a nova base. Selecione uma com `NathGame.setCam04HallState('gotica-platinada')`, `todas` ou `vazia`. A câmera começa com o portão aberto e mantém as personagens selecionadas ao alterná-lo. Veja `outros/prompts/CAM04_ESTADOS_PORTAO.md`.

A CAM05 começa com os dois portões abertos, mostrando breu nas aberturas. G04 controla o portão esquerdo e G05, o direito. Cada configuração dos portões tem 16 combinações de personagens. Selecione uma com `NathGame.setCam05VipState('original-maid')`, `todas` ou `vazia`. A troca de portões mantém as personagens selecionadas, inclusive em reaberturas automáticas. Os recortes da Padrão e da Yandere incluem ajustes nas cadeiras conforme a referência ocupada. Os quatro fundos vazios estão documentados em `outros/prompts/CAM05_ESTADOS_PORTOES.md`.

A CAM06 usa o mesmo fundo para as 32 combinações de personagens. Selecione uma com `NathGame.setCam06VipState('original-platinada-maid')`, `todas` ou `vazia`. A cadeira da Padrão acompanha a posição em que ela aparece sentada na referência.

A CAM07 tem 16 combinações com a Padrão, a Yandere, a Gótica e a Platinada. Selecione uma com `NathGame.setCam07ArcadeState('gotica-platinada')`, `todas` ou `vazia`.

A CAM08 usa a nova imagem do estoque, guardada como `CAM08/master.png`, para as 16 combinações com a Padrão, a Yandere, a Gótica e a Platinada. Selecione uma com `NathGame.setCam08StockroomState('gotica-platinada')`, `todas` ou `vazia`.

A CAM10 usa a nova arte da cozinha sem HUD como base para as 16 combinações da Padrão, da Yandere, da Gótica e da Maid preto e branco. Selecione uma com `NathGame.setCam10KitchenState('yandere-maid')`, `todas` ou `vazia`.

A CAM11 tem 16 combinações com a Padrão, a Yandere, a Gótica e a Maid preto e branco. O cabelo vermelho na borda esquerda identifica a Yandere. Selecione uma combinação com `NathGame.setCam11PickupState('yandere-maid')`, `todas` ou `vazia`.

Na CAM12, o portão hidráulico G06 começa aberto e revela as cortinas vermelhas dos bastidores do palco da CAM03. Clique no G06 ao norte do salão para baixar ou levantar o portão.

Cada estado do G06 tem oito combinações com a Padrão, a Yandere ao fundo e a Gótica. Selecione uma com `NathGame.setCam12CorridorState('original-gotica')`, `todas` ou `vazia`. A seleção permanece ao alternar o portão.

O comando `node tests/camera-gates.cjs` testa a luz F, os estados do escritório, a ligação dos portões com as câmeras e os caminhos de todos os estados. Os comandos `python tests/test_cam05_images.py` e `python tests/test_office_images.py` (Pillow) conferem a consistência dos cenários.

Os três estados da nova sala de controle estão em `public/images/office/states/`. O PNG mestre é a arte nova, e a área clicável acompanha o monitor à esquerda da mesa. Prompts e composição: `outros/prompts/ESCRITORIO_ESTADOS_PORTAO.md`.

O escritório aceita até três animatrônicas na sala e uma diferente na porta lateral. As camadas de `public/images/office/characters/` compõem 101 combinações com o portão principal aberto e 101 com ele fechado. Use `NathGame.setOfficeCharacterState(['original', 'platinada'], 'yandere')` para experimentar e chame a função sem argumentos para esvaziar a cena. A lanterna fica indisponível enquanto houver personagens selecionadas. Para exportar os 202 panoramas em WebP, rode `python scripts/export_office_states.py <pasta-de-destino>` com Pillow.

O mapa da interface usa os **polígonos das salas, aberturas, posições e azimutes das 12 câmeras** em `src/data/game-data.js`. Na parede norte do salão, o G06 ocupa o trecho da antiga passagem azul P17, atrás do palco. As plantas técnicas V8 registram o layout original.

## Observações

- As referências com personagens ficam em `outros/arte/cameras/CAMxx/` e as artes individuais em `outros/arte/animatronics/`. As máscaras do palco ficam em `outros/arte/cameras/CAM03/`. Use `python scripts/compose_cam03.py` para recompor as seis variantes parciais do palco.
- O pacote V8 não incluía arquivos 3D `.glb`/`.gltf`; `public/models/` foi preparado sem modelos inventados.
- Os efeitos de som são sintetizados localmente pelo navegador e começam após o primeiro clique ou tecla, conforme as regras do navegador.
- A sala do escritório é uma **imagem panorâmica pré-renderizada**, não um cenário 3D em tempo real.
- A V1 é uma **base de exploração e vigilância**, não um FNAF completo: ataques, IA, jumpscares e missões podem vir em versões futuras.
