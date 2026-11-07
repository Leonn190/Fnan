# Restaurante da Nathzinha — Web V1 🌸

Primeira versão navegável do fangame de terror **Restaurante da Nathzinha**. O jogo abre diretamente no escritório de segurança: explore a imagem panorâmica, clique no monitor da mesa e alterne entre as doze câmeras pela planta interativa do restaurante.

**Projeto estático puro:** HTML + CSS + JavaScript ES Modules. Não depende de Node.js, npm, Vite, Astro, bundlers, servidores próprios, banco de dados ou etapa de build. Desenvolvido para hospedar diretamente no **GitHub Pages**.

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
│   │   ├── cameras/                 # WEBP otimizadas: CAM01,02,03,05,06,07,08,10,11,12
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

## Como jogar

- **Ao entrar:** você já está no escritório, olhando a imagem panorâmica.
- **Mouse nas bordas esquerda/direita** ou **A/D e ←/→** no escritório: olhar para os lados.
- **Toque e arraste** no escritório em telas touch: deslocar o panorama.
- **Clique no monitor da mesa**, clique na aba inferior ou pressione **Espaço/M**: abrir/fechar as câmeras.
- **Na tela de câmeras:** selecione um ponto do mapa, os botões `01` a `12` ou use as setas **←/→**.
- **Esc:** abaixa o monitor. **?** abre o manual. **♪** liga/desliga o áudio (desligado inicialmente devido às regras dos navegadores).
- O contador de horas vai de 12 AM a 6 AM; ao terminar, é possível reiniciar. Sem animatrônicos, dano, ataques ou mortes nesta versão.

## Câmeras e imagens disponíveis

| ID | Sala da planta | Recurso exibido |
|---|---|---|
| CAM01 | Lojinha | Cena 3D final |
| CAM02 | Recepção | Cena 3D final |
| CAM03 | Salão principal, virada para o palco | Cena 3D do palco |
| CAM04 | Salão principal, parede oposta | **Apenas referência técnica** |
| CAM05 | VIP 1 rosa | Cena 3D final |
| CAM06 | VIP 2 lavanda | Cena 3D final |
| CAM07 | Fliperama | Cena 3D final |
| CAM08 | Estoque | Cena 3D 4K |
| CAM09 | Área de serviço | **Apenas referência técnica** |
| CAM10 | Cozinha | Cena 3D final |
| CAM11 | Corredor de serviço, oeste | Cena 3D do corredor de pedidos/cozinha |
| CAM12 | Corredor de serviço, leste | Cena 3D do corredor da retaguarda |

**Atenção:** CAM04 e CAM09 estão presentes e selecionáveis, mas não havia imagens finais desses dois ângulos no ZIP recebido. Para evitar usar um render de outra sala ou falsificar a arquitetura, o jogo mostra as imagens `public/reference/cameras/CAM04_visao.png` e `CAM09_visao.png`, identificadas como referências técnicas.

### Colocar uma câmera nova depois

1. Adicione sua imagem `public/images/cameras/CAM04.webp` ou `CAM09.webp`. Prefira 16:9, qualidade consistente e **sem animatrônicos** para a imagem-mestra.
2. Em `src/data/game-data.js`, encontre o objeto correspondente e atualize `"image": "./public/images/cameras/CAM04.webp"` e `"renderAvailable": true` (idem CAM09).
3. Salve, envie o commit ao GitHub. A cena será exibida na próxima publicação, sem recompilação.

O mapa da interface é desenhado automaticamente com os **polígonos das salas, aberturas, posições e azimutes das 12 câmeras** do `nathzinha_v7_planta_medidas.json`. As plantas e documentos V8 continuam disponíveis como fonte de referência; o jogo não muda a arquitetura definida.

## Observações

- O projeto não usa os sprites dos animatrônicos ainda. Os três PNGs foram guardados em `public/images/animatronics/` para expansão futura.
- O pacote V8 não incluía arquivos 3D `.glb`/`.gltf`; `public/models/` foi preparado sem modelos inventados.
- Os efeitos de som são sintetizados localmente pelo navegador e só tocam após ativação voluntária.
- A sala do escritório é uma **imagem panorâmica pré-renderizada**, não um cenário 3D em tempo real.
- A V1 é uma **base de exploração e vigilância**, não um FNAF completo: ataques, IA, portas funcionais, energia como condição de derrota, jumpscares e missões podem vir em versões futuras.
