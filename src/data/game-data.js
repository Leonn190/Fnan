(() => {
'use strict';
// Base do projeto V8: outros/planta/nathzinha_v7_planta_medidas.json
// Coordenadas: origem sudoeste, x=leste, y=norte, em metros.
const VIP1_GATE_IMAGES = {
  'open-open': './public/images/cameras/CAM05/states/open-open/vazia.webp',
  'open-closed': './public/images/cameras/CAM05/states/open-closed/vazia.webp',
  'closed-open': './public/images/cameras/CAM05/states/closed-open/vazia.webp',
  'closed-closed': './public/images/cameras/CAM05/base.webp'
};
const VIP1_CHARACTER_STATES = [
  'original', 'yandere', 'gotica', 'maid',
  'original-yandere', 'original-gotica', 'original-maid',
  'yandere-gotica', 'yandere-maid', 'gotica-maid',
  'original-yandere-gotica', 'original-yandere-maid',
  'original-gotica-maid', 'yandere-gotica-maid', 'todas'
];

// Elenco retratado em "todas" por câmera. Este arquivo não é um estado genérico.
const TRIO = ['original', 'yandere', 'gotica'];
const WITH_CAT = [...TRIO, 'platinada'];
const WITH_MAID = [...TRIO, 'maid'];
const CAM03_FLOOR_STATES = [
  'palco-vazio--salao-original',
  'palco-vazio--salao-yandere',
  'palco-vazio--salao-gotica',
  'palco-vazio--salao-original-yandere',
  'palco-vazio--salao-original-gotica',
  'palco-vazio--salao-yandere-gotica',
  'palco-vazio--salao-original-yandere-gotica',
  'palco-original--salao-yandere',
  'palco-original--salao-gotica',
  'palco-original--salao-yandere-gotica',
  'palco-yandere--salao-original',
  'palco-yandere--salao-gotica',
  'palco-yandere--salao-original-gotica',
  'palco-gotica--salao-original',
  'palco-gotica--salao-yandere',
  'palco-gotica--salao-original-yandere',
  'palco-original-yandere--salao-gotica',
  'palco-original-gotica--salao-yandere',
  'palco-yandere-gotica--salao-original'
];
const CAMERAS = [
  {
    "id": "CAM01",
    "number": 1,
    "name": "Lojinha",
    "room": "loja",
    "x": 11.05,
    "y": 5.15,
    "angle": 225,
    "fov": 88,
    "image": "./public/images/cameras/CAM01/base.webp",
    "allCharacters": WITH_CAT,
    "characterStateImages": { "todas": "./public/images/cameras/CAM01/states/todas.webp" },
    "technical": "./public/images/cameras/CAM01/technical.png",
    "renderAvailable": true
  },
  {
    "id": "CAM02",
    "number": 2,
    "name": "Recepção",
    "room": "recepcao",
    "x": 19.2,
    "y": 4.0,
    "angle": 270,
    "fov": 95,
    "image": "./public/images/cameras/CAM02/base.webp",
    "allCharacters": WITH_CAT,
    "characterStateImages": { "todas": "./public/images/cameras/CAM02/states/todas.webp" },
    "technical": "./public/images/cameras/CAM02/technical.png",
    "renderAvailable": true
  },
  {
    "id": "CAM03",
    "number": 3,
    "name": "Salão • Palco",
    "room": "salao",
    "x": 11.5,
    "y": 16.2,
    "angle": 24,
    "fov": 92,
    "image": "./public/images/cameras/CAM03/base.webp",
    "allCharacters": TRIO,
    "stageStateImages": {
      "original": "./public/images/cameras/CAM03/states/original.webp",
      "yandere": "./public/images/cameras/CAM03/states/yandere.webp",
      "gotica": "./public/images/cameras/CAM03/states/gotica.webp",
      "original-yandere": "./public/images/cameras/CAM03/states/original-yandere.webp",
      "original-gotica": "./public/images/cameras/CAM03/states/original-gotica.webp",
      "yandere-gotica": "./public/images/cameras/CAM03/states/yandere-gotica.webp",
      "todas": "./public/images/cameras/CAM03/states/todas.webp",
      ...Object.fromEntries(CAM03_FLOOR_STATES.map(key => [key, `./public/images/cameras/CAM03/states/${key}.webp`]))
    },
    "technical": "./public/images/cameras/CAM03/technical.png",
    "renderAvailable": true
  },
  {
    "id": "CAM04",
    "number": 4,
    "name": "Salão • Leste",
    "room": "salao",
    "x": 27.8,
    "y": 10.55,
    "angle": 208,
    "fov": 88,
    "image": "./public/images/cameras/CAM04/base.webp",
    "allCharacters": WITH_CAT,
    "gateStateImages": {
      "gates": ["G08"],
      "images": {
        "open": "./public/images/cameras/CAM04/states/open/vazia.webp",
        "closed": "./public/images/cameras/CAM04/base.webp"
      }
    },
    "characterStateImages": {
      "todas": {
        "open": "./public/images/cameras/CAM04/states/open/todas.webp",
        "closed": "./public/images/cameras/CAM04/states/closed/todas.webp"
      }
    },
    "technical": "./public/images/cameras/CAM04/technical.png",
    "renderAvailable": true
  },
  {
    "id": "CAM05",
    "number": 5,
    "name": "VIP 1 • Rosa",
    "room": "vip1",
    "x": 6.95,
    "y": 21.95,
    "angle": 322,
    "fov": 82,
    "image": "./public/images/cameras/CAM05/base.webp",
    "allCharacters": WITH_MAID,
    "gateStateImages": {
      "gates": ["G04", "G05"],
      "images": VIP1_GATE_IMAGES
    },
    "characterStateImages": Object.fromEntries(VIP1_CHARACTER_STATES.map(characters => [
      characters,
      Object.fromEntries(Object.keys(VIP1_GATE_IMAGES).map(gates => [
        gates, `./public/images/cameras/CAM05/states/${gates}/${characters}.webp`
      ]))
    ])),
    "technical": "./public/images/cameras/CAM05/technical.png",
    "renderAvailable": true
  },
  {
    "id": "CAM06",
    "number": 6,
    "name": "VIP 2 • Lavanda",
    "room": "vip2",
    "x": 6.95,
    "y": 10.25,
    "angle": 38,
    "fov": 82,
    "image": "./public/images/cameras/CAM06/base.webp",
    "allCharacters": [...WITH_CAT, 'maid'],
    "characterStateImages": Object.fromEntries([
      'original',
      'yandere',
      'gotica',
      'platinada',
      'maid',
      'original-yandere',
      'original-gotica',
      'yandere-gotica',
      'original-platinada',
      'yandere-platinada',
      'gotica-platinada',
      'original-maid',
      'yandere-maid',
      'gotica-maid',
      'platinada-maid',
      'original-yandere-gotica',
      'original-yandere-platinada',
      'original-gotica-platinada',
      'yandere-gotica-platinada',
      'original-yandere-maid',
      'original-gotica-maid',
      'yandere-gotica-maid',
      'original-platinada-maid',
      'yandere-platinada-maid',
      'gotica-platinada-maid',
      'original-yandere-gotica-platinada',
      'original-yandere-gotica-maid',
      'original-yandere-platinada-maid',
      'original-gotica-platinada-maid',
      'yandere-gotica-platinada-maid',
      'todas'
    ].map(characters => [characters, `./public/images/cameras/CAM06/states/${characters}.webp`])),
    "technical": "./public/images/cameras/CAM06/technical.png",
    "renderAvailable": true
  },
  {
    "id": "CAM07",
    "number": 7,
    "name": "Fliperama",
    "room": "fliperama",
    "x": 32.22,
    "y": 0.28,
    "angle": 138,
    "fov": 88,
    "image": "./public/images/cameras/CAM07/base.webp",
    "allCharacters": WITH_CAT,
    "characterStateImages": { "todas": "./public/images/cameras/CAM07/states/todas.webp" },
    "technical": "./public/images/cameras/CAM07/technical.png",
    "renderAvailable": true
  },
  {
    "id": "CAM08",
    "number": 8,
    "name": "Estoque",
    "room": "estoque",
    "x": 0.25,
    "y": 9.15,
    "angle": 22,
    "fov": 82,
    "image": "./public/images/cameras/CAM08/base.webp",
    "allCharacters": WITH_CAT,
    "characterStateImages": { "todas": "./public/images/cameras/CAM08/states/todas.webp" },
    "technical": "./public/images/cameras/CAM08/technical.png",
    "renderAvailable": true
  },
  {
    "id": "CAM09",
    "number": 9,
    "name": "Área de Serviço",
    "room": "servico",
    "x": 0.25,
    "y": 21.95,
    "angle": 332,
    "fov": 82,
    "image": "./public/images/cameras/CAM09/base.webp",
    "allCharacters": ["maid"],
    "technical": "./public/images/cameras/CAM09/technical.png",
    "renderAvailable": true
  },
  {
    "id": "CAM10",
    "number": 10,
    "name": "Cozinha",
    "room": "cozinha",
    "x": 0.25,
    "y": 27.72,
    "angle": 334,
    "fov": 84,
    "image": "./public/images/cameras/CAM10/base.webp",
    "allCharacters": WITH_MAID,
    "characterStateImages": { "todas": "./public/images/cameras/CAM10/states/todas.webp" },
    "technical": "./public/images/cameras/CAM10/technical.png",
    "renderAvailable": true
  },
  {
    "id": "CAM11",
    "number": 11,
    "name": "Retirada de Pedidos",
    "room": "retirada",
    "x": 11.55,
    "y": 25.15,
    "angle": 68,
    "fov": 88,
    "image": "./public/images/cameras/CAM11/base.webp",
    "allCharacters": WITH_MAID,
    "characterStateImages": { "todas": "./public/images/cameras/CAM11/states/todas.webp" },
    "technical": "./public/images/cameras/CAM11/technical.png",
    "renderAvailable": true
  },
  {
    "id": "CAM12",
    "number": 12,
    "name": "Corredor • Leste",
    "room": "corredor_servico",
    "x": 32.22,
    "y": 23.25,
    "angle": 180,
    "fov": 82,
    "image": "./public/images/cameras/CAM12/base.webp",
    "allCharacters": TRIO,
    "gateStateImages": {
      "gates": ["G06"],
      "images": {
        "open": "./public/images/cameras/CAM12/states/open/vazia.webp",
        "closed": "./public/images/cameras/CAM12/base.webp"
      }
    },
    "characterStateImages": {
      "todas": {
        "open": "./public/images/cameras/CAM12/states/open/todas.webp",
        "closed": "./public/images/cameras/CAM12/states/closed/todas.webp"
      }
    },
    "technical": "./public/images/cameras/CAM12/technical.png",
    "renderAvailable": true
  }
];

const VENUE = {
  "width": 32.5,
  "height": 28.0,
  "rooms": [
    {
      "id": "loja",
      "name": "Lojinha",
      "points": [
        [
          0,
          0
        ],
        [
          12.1,
          0
        ],
        [
          12.1,
          5.4
        ],
        [
          3.5,
          5.4
        ],
        [
          3.5,
          6.0
        ],
        [
          0,
          6.0
        ]
      ]
    },
    {
      "id": "recepcao",
      "name": "Recepção / Entrada",
      "points": [
        [
          12.1,
          0
        ],
        [
          26.8,
          0
        ],
        [
          26.8,
          4.2
        ],
        [
          12.1,
          4.2
        ]
      ]
    },
    {
      "id": "fliperama",
      "name": "Fliperama",
      "points": [
        [
          26.8,
          0
        ],
        [
          32.5,
          0
        ],
        [
          32.5,
          10.8
        ],
        [
          27.8,
          10.8
        ],
        [
          27.8,
          4.2
        ],
        [
          26.8,
          4.2
        ]
      ]
    },
    {
      "id": "estoque",
      "name": "Estoque",
      "points": [
        [
          0,
          6
        ],
        [
          3.5,
          6
        ],
        [
          3.5,
          9.5
        ],
        [
          4.4,
          9.5
        ],
        [
          4.4,
          16
        ],
        [
          0,
          16
        ]
      ]
    },
    {
      "id": "controle",
      "name": "Sala de Controle",
      "points": [
        [
          3.5,
          5.4
        ],
        [
          8,
          5.4
        ],
        [
          8,
          9.5
        ],
        [
          3.5,
          9.5
        ]
      ]
    },
    {
      "id": "armario",
      "name": "Armário",
      "points": [
        [
          8,
          5.4
        ],
        [
          9.4,
          5.4
        ],
        [
          9.4,
          7.8
        ],
        [
          8,
          7.8
        ]
      ]
    },
    {
      "id": "vip2",
      "name": "VIP 2",
      "points": [
        [
          6.8,
          9.5
        ],
        [
          8.0,
          9.5
        ],
        [
          8.0,
          7.8
        ],
        [
          11.4,
          7.8
        ],
        [
          11.4,
          16.2
        ],
        [
          6.8,
          16.2
        ]
      ]
    },
    {
      "id": "vip1",
      "name": "VIP 1",
      "points": [
        [
          6.8,
          16.2
        ],
        [
          11.4,
          16.2
        ],
        [
          11.4,
          22.2
        ],
        [
          6.8,
          22.2
        ]
      ]
    },
    {
      "id": "servico",
      "name": "Área de Serviço",
      "points": [
        [
          0,
          16.0
        ],
        [
          4.4,
          16.0
        ],
        [
          4.4,
          22.2
        ],
        [
          0,
          22.2
        ]
      ]
    },
    {
      "id": "cozinha",
      "name": "Cozinha",
      "points": [
        [
          0,
          22.2
        ],
        [
          4.4,
          22.2
        ],
        [
          4.4,
          24.4
        ],
        [
          10.8,
          24.4
        ],
        [
          10.8,
          28.0
        ],
        [
          0,
          28.0
        ]
      ]
    },
    {
      "id": "corredor_servico",
      "name": "Corredor de Serviço / Retaguarda",
      "points": [
        [
          6.8,
          9.5
        ],
        [
          4.4,
          9.5
        ],
        [
          4.4,
          24.4
        ],
        [
          6.8,
          24.4
        ],
        [
          30.3,
          24.4
        ],
        [
          30.3,
          28.0
        ],
        [
          32.5,
          28.0
        ],
        [
          32.5,
          24.4
        ],
        [
          32.5,
          22.2
        ],
        [
          6.8,
          22.2
        ]
      ]
    },
    {
      "id": "retirada",
      "name": "Área de Retirada de Comida",
      "points": [
        [
          10.8,
          24.4
        ],
        [
          18.0,
          24.4
        ],
        [
          18.0,
          28.0
        ],
        [
          10.8,
          28.0
        ]
      ]
    },
    {
      "id": "nathzinha",
      "name": "Sala da Nathzinha",
      "points": [
        [
          18.0,
          24.4
        ],
        [
          24.5,
          24.4
        ],
        [
          24.5,
          28.0
        ],
        [
          18.0,
          28.0
        ]
      ]
    },
    {
      "id": "eletrica",
      "name": "Elétrica",
      "points": [
        [
          24.5,
          24.4
        ],
        [
          30.3,
          24.4
        ],
        [
          30.3,
          28
        ],
        [
          24.5,
          28
        ]
      ]
    },
    {
      "id": "wc_func",
      "name": "WC Funcionários",
      "points": [
        [
          27.8,
          19.0
        ],
        [
          32.5,
          19.0
        ],
        [
          32.5,
          22.2
        ],
        [
          27.8,
          22.2
        ]
      ]
    },
    {
      "id": "circ_wc",
      "name": "Circulação WC",
      "points": [
        [
          27.8,
          10.8
        ],
        [
          32.5,
          10.8
        ],
        [
          32.5,
          13.6
        ],
        [
          27.8,
          13.6
        ]
      ]
    },
    {
      "id": "wc_m",
      "name": "WC Masc.",
      "points": [
        [
          27.8,
          13.6
        ],
        [
          30.15,
          13.6
        ],
        [
          30.15,
          19.0
        ],
        [
          27.8,
          19.0
        ]
      ]
    },
    {
      "id": "wc_f",
      "name": "WC Fem.",
      "points": [
        [
          30.15,
          13.6
        ],
        [
          32.5,
          13.6
        ],
        [
          32.5,
          19.0
        ],
        [
          30.15,
          19.0
        ]
      ]
    },
    {
      "id": "salao",
      "name": "Salão Principal",
      "points": [
        [
          11.4,
          22.2
        ],
        [
          27.8,
          22.2
        ],
        [
          27.8,
          19.0
        ],
        [
          27.8,
          13.6
        ],
        [
          27.8,
          10.8
        ],
        [
          27.8,
          4.2
        ],
        [
          12.1,
          4.2
        ],
        [
          12.1,
          5.4
        ],
        [
          9.4,
          5.4
        ],
        [
          9.4,
          7.8
        ],
        [
          11.4,
          7.8
        ]
      ]
    }
  ],
  "openings": [
    {
      "id": "EXT01",
      "axis": "H",
      "at": 0.0,
      "start": 18.0,
      "end": 20.0,
      "type": "saida"
    },
    {
      "id": "EXT02",
      "axis": "V",
      "at": 0.0,
      "start": 10.8,
      "end": 12.2,
      "type": "saida"
    },
    {
      "id": "EXT03",
      "axis": "H",
      "at": 28.0,
      "start": 31.15,
      "end": 31.85,
      "type": "saida"
    },
    {
      "id": "G01",
      "axis": "H",
      "at": 9.5,
      "start": 5.05,
      "end": 6.45,
      "type": "portao"
    },
    {
      "id": "G02",
      "axis": "V",
      "at": 6.8,
      "start": 12.3,
      "end": 13.7,
      "type": "portao"
    },
    {
      "id": "G03",
      "axis": "V",
      "at": 11.4,
      "start": 12.3,
      "end": 13.7,
      "type": "portao"
    },
    {
      "id": "G04",
      "axis": "V",
      "at": 6.8,
      "start": 18.5,
      "end": 19.9,
      "type": "portao"
    },
    {
      "id": "G05",
      "axis": "V",
      "at": 11.4,
      "start": 18.5,
      "end": 19.9,
      "type": "portao"
    },
    {
      "id": "G06",
      "axis": "H",
      "at": 22.2,
      "start": 19.25,
      "end": 20.75,
      "type": "portao"
    },
    {
      "id": "G07",
      "axis": "V",
      "at": 27.8,
      "start": 11.5,
      "end": 12.9,
      "type": "portao"
    },
    {
      "id": "G08",
      "axis": "H",
      "at": 4.2,
      "start": 24.0,
      "end": 25.8,
      "type": "portao"
    },
    {
      "id": "G09",
      "axis": "H",
      "at": 6.0,
      "start": 1.25,
      "end": 2.75,
      "type": "portao"
    },
    {
      "id": "P01",
      "axis": "V",
      "at": 12.1,
      "start": 1.4,
      "end": 3.2,
      "type": "livre"
    },
    {
      "id": "P02",
      "axis": "V",
      "at": 3.5,
      "start": 7.4,
      "end": 8.7,
      "type": "livre"
    },
    {
      "id": "P03",
      "axis": "V",
      "at": 4.4,
      "start": 12.7,
      "end": 14.0,
      "type": "livre"
    },
    {
      "id": "P04",
      "axis": "V",
      "at": 4.4,
      "start": 18.7,
      "end": 20.0,
      "type": "livre"
    },
    {
      "id": "P05",
      "axis": "V",
      "at": 8.0,
      "start": 6.1,
      "end": 7.3,
      "type": "livre"
    },
    {
      "id": "P06",
      "axis": "H",
      "at": 22.2,
      "start": 1.4,
      "end": 2.5,
      "type": "livre"
    },
    {
      "id": "P07",
      "axis": "V",
      "at": 4.4,
      "start": 22.8,
      "end": 23.9,
      "type": "livre"
    },
    {
      "id": "P08",
      "axis": "H",
      "at": 24.4,
      "start": 8.7,
      "end": 9.7,
      "type": "livre"
    },
    {
      "id": "P09",
      "axis": "V",
      "at": 10.8,
      "start": 25.3,
      "end": 26.5,
      "type": "livre"
    },
    {
      "id": "P10",
      "axis": "H",
      "at": 24.4,
      "start": 12.9,
      "end": 17.1,
      "type": "livre"
    },
    {
      "id": "P11",
      "axis": "H",
      "at": 24.4,
      "start": 20.0,
      "end": 21.8,
      "type": "livre"
    },
    {
      "id": "P12",
      "axis": "H",
      "at": 24.4,
      "start": 26.9,
      "end": 28.4,
      "type": "livre"
    },
    {
      "id": "P13",
      "axis": "H",
      "at": 22.2,
      "start": 29.2,
      "end": 30.5,
      "type": "livre"
    },
    {
      "id": "P14",
      "axis": "H",
      "at": 10.8,
      "start": 28.35,
      "end": 31.95,
      "type": "livre"
    },
    {
      "id": "P15",
      "axis": "H",
      "at": 13.6,
      "start": 28.4,
      "end": 29.55,
      "type": "livre"
    },
    {
      "id": "P16",
      "axis": "H",
      "at": 13.6,
      "start": 30.65,
      "end": 31.8,
      "type": "livre"
    }
  ],
  "objects": [
    {
      "id": "PALCO",
      "type": "palco",
      "bounds": [
        15.3,
        18.9,
        23.9,
        21.8
      ]
    },
    {
      "id": "BALCAO_ENTRADA",
      "type": "balcao",
      "bounds": [
        17.2,
        1.1,
        21.0,
        2.0
      ]
    },
    {
      "id": "BALCAO_LOJA",
      "type": "balcao",
      "bounds": [
        1.0,
        4.35,
        6.6,
        5.15
      ]
    },
    {
      "id": "BALCAO_RETIRADA",
      "type": "balcao",
      "bounds": [
        14.2,
        24.85,
        16.9,
        25.6
      ]
    },
    {
      "id": "MESA_CONTROLE",
      "type": "mesa",
      "bounds": [
        4.65,
        6.45,
        7.1,
        7.35
      ]
    },
    {
      "id": "MESA_VIP1",
      "type": "mesa",
      "bounds": [
        7.65,
        18.1,
        10.4,
        20.0
      ]
    },
    {
      "id": "MESA_VIP2",
      "type": "mesa",
      "bounds": [
        7.65,
        12.1,
        10.4,
        14.0
      ]
    }
  ]
};

const OFFICE = {
  gate: 'G01',
  room: 'controle',
  doorwayPassage: 'P02',
  doorwayCharacters: ['original', 'gotica', 'yandere', 'platinada'],
  // Ordem das camadas da sala, da mais distante para a mais próxima.
  characters: ['original', 'maid', 'gotica', 'yandere', 'platinada'],
  images: {
    dark: './public/images/office/states/open-dark.webp',
    lit: './public/images/office/states/open-lit.webp',
    closed: './public/images/office/states/closed.webp'
  }
};

// Posições internas de config/map.json, em metros na mesma planta de VENUE.
// 8, 11 e 22 ligam as rotas pelo lado de fora do restaurante.
window.NathGame = { CAMERAS, VENUE, OFFICE };

})();
