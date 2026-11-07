# CHECKLIST DE APROVAÇÃO DE IMAGENS — V8

> Marque antes de inserir qualquer render final no jogo. Um cenário só é aprovado se preservar o layout em todas as câmeras compartilhadas.

## Geometria e câmera
- [ ] A lente ocupa a mesma posição da V7 (x, y e altura), sem inverter leste/oeste.
- [ ] O azimute e a abertura horizontal estão consistentes com a ficha da câmera.
- [ ] A planta, o FOV 2D e a oclusão não foram interpretados como permissão para enxergar através das paredes.
- [ ] Portões vermelhos, portas azuis e saídas verdes foram preservados em posição e função.
- [ ] Não foram criados corredores, janelas ou portas que a planta não descreve.
- [ ] Portão G01 da sala de controle continua centralizado; CAM11 continua em 135°.
- [ ] O único corredor de serviço continua em L; palco permanece no norte.

## Identidade visual
- [ ] Predomínio rosa pastel (em área pública), lilás como apoio e azul bebê apenas como acento.
- [ ] Lacinhos e :3 aparecem de forma elegante, sem excesso.
- [ ] A sensação é de restaurante japonês temático real, não quarto infantil ou ilustração.
- [ ] Não há cópia de marcas, mascotes ou logo Sanrio nas imagens finais.
- [ ] Os pôsteres anime, quando presentes, exibem apenas personagens claramente adultas e não contêm nudez.

## Consistência em produção
- [ ] Móveis e pôsteres ocupam os mesmos lugares entre câmeras do mesmo ambiente.
- [ ] Dia/noite muda a iluminação, não a arquitetura ou a decoração.
- [ ] Existe versão limpa, sem animatrônicos, para edição e cenas de jogo.
- [ ] Objetos não bloqueiam portas, saídas, corredores e percurso do jogador/animatrônicos.
- [ ] Nenhuma interface ou selo CAMXX foi embutido irremovivelmente no background.
- [ ] A textura, a luz e a câmera são consistentes com um frame de cenário 3D pré-renderizado.

## Organização de arquivo sugerida após geração
`renders/CAMXX_DIA_LIMPA.png` e `renders/CAMXX_NOITE_LIMPA.png`.

**Limite:** a V7 é uma referência espacial em planta, não um modelo 3D completo; portas não representadas em altura e obstáculos de mobília exigem decisão de produção documentada.
