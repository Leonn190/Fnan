(() => {
'use strict';
// Gerado a partir do projeto V8: outros/planta/nathzinha_v7_planta_medidas.json
// Coordenadas: origem sudoeste, x=leste, y=norte, em metros.
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
    "image": "./public/images/cameras/CAM01.webp",
    "technical": "./public/reference/cameras/CAM01_visao.png",
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
    "image": "./public/images/cameras/CAM02.webp",
    "technical": "./public/reference/cameras/CAM02_visao.png",
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
    "image": "./public/images/cameras/CAM03.webp",
    "technical": "./public/reference/cameras/CAM03_visao.png",
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
    "image": "./public/images/cameras/CAM04.webp",
    "gateStateImages": {
      "gates": ["G08"],
      "images": {
        "open": "./public/images/cameras/states/CAM04-open.webp",
        "closed": "./public/images/cameras/CAM04.webp"
      }
    },
    "technical": "./public/reference/cameras/CAM04_visao.png",
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
    "image": "./public/images/cameras/CAM05.webp",
    "gateStateImages": {
      "gates": ["G04", "G05"],
      "images": {
        "open-open": "./public/images/cameras/states/CAM05-open-open.png",
        "open-closed": "./public/images/cameras/states/CAM05-open-closed.png",
        "closed-open": "./public/images/cameras/states/CAM05-closed-open.png",
        "closed-closed": "./public/images/cameras/originals/CAM05.png"
      }
    },
    "technical": "./public/reference/cameras/CAM05_visao.png",
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
    "image": "./public/images/cameras/CAM06.webp",
    "technical": "./public/reference/cameras/CAM06_visao.png",
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
    "image": "./public/images/cameras/CAM07.webp",
    "technical": "./public/reference/cameras/CAM07_visao.png",
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
    "image": "./public/images/cameras/CAM08.webp",
    "technical": "./public/reference/cameras/CAM08_visao.png",
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
    "image": "./public/images/cameras/CAM09.webp",
    "technical": "./public/reference/cameras/CAM09_visao.png",
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
    "image": "./public/images/cameras/CAM10.webp",
    "technical": "./public/reference/cameras/CAM10_visao.png",
    "renderAvailable": true
  },
  {
    "id": "CAM11",
    "number": 11,
    "name": "Corredor • Oeste",
    "room": "corredor_servico",
    "x": 15.2,
    "y": 22.28,
    "angle": 135,
    "fov": 88,
    "image": "./public/images/cameras/CAM11.webp",
    "technical": "./public/reference/cameras/CAM11_visao.png",
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
    "image": "./public/images/cameras/CAM12.webp",
    "technical": "./public/reference/cameras/CAM12_visao.png",
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
      "start": 24.8,
      "end": 26.3,
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
    },
    {
      "id": "P17",
      "axis": "H",
      "at": 22.2,
      "start": 19.1,
      "end": 20.9,
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
  images: {
    dark: './public/images/office/states/office-open-dark.webp',
    lit: './public/images/office/states/office-open-lit.webp',
    closed: './public/images/office/states/office-closed.webp'
  }
};

window.NathGame = { CAMERAS, VENUE, OFFICE };

})();
