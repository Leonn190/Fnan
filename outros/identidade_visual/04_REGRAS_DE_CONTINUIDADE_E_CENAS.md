# CONTINUIDADE GEOMÉTRICA, VISUAL E FLUXO DE TRABALHO — V8

## Autoridade de dados
A imagem e o JSON da planta V7 determinam posições, dimensões, portas, portões e paredes. O arquivo `nathzinha_v7_visibilidade_calculada.json` e `cameras/CAMXX_visao.png` documentam a oclusão **em planta 2D**, considerando paredes e portões no estado da simulação. A arte V8 não pode alterar tais definições.

**Sistema:** origem sudoeste, x aumenta a leste, y aumenta ao norte, em metros. Azimutes extraídos literalmente da V7; não trocar norte e sul, não espelhar coordenadas.

## Restrições arquitetônicas obrigatórias da V7
- Existe um único corredor de serviço em L, que permanece contínuo.
- Não há passagem direta da área de serviço para o estoque.
- Não existe portão direto da sala de controle para a lojinha.
- A VIP 2 tem formato recortado e encosta na face norte do armário.
- As salas VIP têm 4,6 m de largura e acessos pelos dois lados.
- O portão norte da sala de controle fica centralizado sobre a largura total dessa sala.
- A lojinha avança discretamente sobre a recepção e tem um recorte para o controle e armário.
- Há uma passagem azul na parede norte do salão, atrás do palco, para o corredor de serviço.
- A circulação horizontal dos banheiros tem duas portas na parede norte e passagem larga ao fliperama no sul.
- A saída superior permanece na parte de cima do corredor, ao lado da elétrica, que agora é mais estreita.

## Aberturas e portões
- **Azul = passagem/porta livre** na planta técnica; a decoração não pode convertê-la em parede.
- **Vermelho = portão mecânico controlável**; manter posição, vão e estado funcional em todas as variantes.
- **Verde = saída externa**; não bloquear com móveis ou propaganda.
- **Preto = parede opaca**; nada de janela espontânea ou visão transparecendo.
- A codificação técnica não obriga portões pintados de vermelho no render final: podem ganhar carenagem rosada/lavanda, desde que continuem inequivocamente mecânicos e operáveis.
- O vão largo da retirada **não é uma janelinha de entrega**; manter abertura ampla.

## Planejamento de imagens
1. Registrar uma **foto-mestra limpa, sem animatrônicos**, do salão em CAM03, estabelecendo materiais e mobiliário.
2. Fotografar/renderizar a mesma cena em CAM04, com posições de mesas, palco e cores idênticas.
3. Criar os ambientes adjacentes conforme a ordem de câmeras (VIPs, recepção/loja, backstage).
4. Exportar para cada enquadramento: `CAMXX_DIA_LIMPA.png`, `CAMXX_NOITE_LIMPA.png` e, se necessário posteriormente, variantes com animatrônicos como camadas/cenas separadas.
5. Usar **a mesma árvore de objetos, móveis, placas e pôsteres** nas vistas sobrepostas. Nunca regenerar a sala como se fosse outro local.

## Regras técnicas de câmera e acabamento
- Posição da lente, altura, azimute e FOV horizontal **exatos** conforme JSON V7.
- Inclinação vertical/altura exata da direção da lente não estão integralmente descritas no pacote 2D: escolher uma inclinação 3D plausível, documentá-la e mantê-la constante na câmera; não chamar essa escolha de dado original.
- Sugestão de saída: imagem mestra 16:9, 3840×2160 se o render permitir; exportações leves 1920×1080 e versões com pós de CCTV separadas.
- Sem HUD embutido no background: hora, textos CAMXX, estática, filtros, sprites e interface ficam como camadas do jogo.
- Qualidade: 3D fotorealista pré-renderizado, escala coerente, geometria confiável; granulação, vinheta e lens distortion discretos só na pós.
- Fundo limpo sem personagens, para permitir versões do jogo com diferentes posições de animatrônicos.

## Regras de continuação entre conversas
Sempre enviar: ZIP V8, referência V7 da planta, câmera específica `cameras/CAMXX_visao.png`, material de arte pertinente. Não assumir que o gerador de imagem consegue extrair o ZIP sozinho. Em caso de conflito entre prompt e planta, prevalece planta; entre sugestão de decoração e identidade V8, prevalece V8.

## Lista de erros a bloquear em revisões
- Portão G01 descentralizado na sala de controle.
- CAM11 reproduzida com orientação anterior, em vez de 135°.
- Cozinha conectando dois corredores separados.
- Porta inexistente sala de controle ↔ lojinha.
- Acesso direto estoque ↔ área de serviço.
- VIP 2 sem seu recorte estrutural.
- WC/arcade/circulação dos banheiros redimensionados por conveniência de cenário.
- Palco mudando de parede ou sumindo em ângulo que deveria vê-lo.
