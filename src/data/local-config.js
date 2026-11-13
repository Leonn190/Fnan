// Gerado por scripts/sync-local-config.cjs a partir de config/*.json.
window.NathGame.localConfig = {
  "characters": {
    "padrao": {
      "name": "Nathzinha Padrão",
      "artId": "original",
      "start": 1,
      "positions": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        17,
        18,
        19,
        20,
        22
      ],
      "cameras": [
        "CAM01",
        "CAM02",
        "CAM03",
        "CAM04",
        "CAM05",
        "CAM06",
        "CAM07",
        "CAM08",
        "CAM10",
        "CAM11",
        "CAM12"
      ],
      "interval": 24,
      "reaction": 3.5,
      "routes": {
        "CV": 19,
        "CC": 19,
        "EL": 16,
        "EC": 15,
        "EV": 10,
        "ES": 21
      },
      "audioModifier": -45,
      "doorChance": [
        70,
        94
      ]
    },
    "gotica": {
      "name": "Nathzinha Gótica",
      "artId": "gotica",
      "start": 1,
      "positions": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        9,
        10,
        12,
        13,
        14,
        15,
        17,
        18,
        19
      ],
      "cameras": [
        "CAM01",
        "CAM02",
        "CAM03",
        "CAM04",
        "CAM05",
        "CAM06",
        "CAM07",
        "CAM08",
        "CAM10",
        "CAM11",
        "CAM12"
      ],
      "interval": 26,
      "reaction": 4.5,
      "routes": {
        "CV": 30,
        "CC": 30,
        "EL": 20,
        "EC": 10,
        "EV": 10
      },
      "audioModifier": 60,
      "staticChance": [
        75,
        99
      ]
    },
    "yandere": {
      "name": "Nathzinha Yandere",
      "artId": "yandere",
      "start": 1,
      "positions": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        9,
        10,
        12,
        13,
        14,
        15,
        17,
        18,
        19,
        21
      ],
      "cameras": [
        "CAM01",
        "CAM02",
        "CAM03",
        "CAM04",
        "CAM05",
        "CAM06",
        "CAM07",
        "CAM08",
        "CAM10",
        "CAM11",
        "CAM12"
      ],
      "interval": 21,
      "reaction": 4.5,
      "routes": {
        "CV": 22,
        "CC": 22,
        "EL": 10,
        "EC": 14,
        "EV": 8,
        "EE": 24
      },
      "audioModifier": 60,
      "firstIntervalFactor": 0.6
    },
    "gatinha": {
      "name": "Nathzinha Gatinha",
      "artId": "platinada",
      "start": 3,
      "positions": [
        3,
        4,
        5,
        7,
        9,
        10,
        12,
        13,
        14,
        15,
        23,
        24,
        25
      ],
      "cameras": [
        "CAM01",
        "CAM02",
        "CAM04",
        "CAM06",
        "CAM07",
        "CAM08"
      ],
      "interval": 19,
      "reaction": 4.5,
      "routes": {
        "CV": 48,
        "EL": 26,
        "EV": 26
      },
      "audioModifier": 30,
      "hidingPlaces": [
        23,
        24,
        25
      ],
      "hidingBonus": 5,
      "extraIntervalReduction": 5
    },
    "maid": {
      "name": "Nathzinha Maid",
      "artId": "maid",
      "start": 16,
      "positions": [
        6,
        7,
        13,
        14,
        15,
        16,
        17,
        18
      ],
      "cameras": [
        "CAM05",
        "CAM06",
        "CAM09",
        "CAM10",
        "CAM11"
      ],
      "interval": 29,
      "reaction": 2.5,
      "targetBonus": 10,
      "audioModifier": 30,
      "initialStationaryAttempts": 1,
      "initialIntervalReduction": 10
    }
  },
  "controls": {
    "closetTransitionsMs": {
      "enter": {
        "swap": 980,
        "duration": 1450
      },
      "exit": {
        "swap": 650,
        "duration": 1040
      }
    },
    "jumpscare": {
      "blackoutMs": 110,
      "cycleMs": 960,
      "clownBottomCycleMs": 1280,
      "finalHoldMs": 250,
      "flashMs": 230,
      "imageLoadWaitMs": 2000,
      "volume": 0.55
    },
    "radioTracks": [
      "caramelldansen.mp3",
      "shikairo-days.mp3",
      "kawaikute-gomen.mp3"
    ],
    "menuMusic": {
      "startSeconds": 27,
      "fadeSeconds": 2,
      "initialVolume": 0.08,
      "volume": 0.58
    },
    "observation": {
      "leftPanFraction": 0.55,
      "corridorPanFraction": 0.5
    },
    "unillustratedCameraPositions": [
      8,
      11
    ]
  },
  "effects": {
    "cameraAudio": {
      "duration": 3,
      "cooldown": 10,
      "factors": [
        1,
        1,
        0.2
      ]
    },
    "static": {
      "duration": 2,
      "visual": {
        "gotica": {
          "durationMs": 2000,
          "intensity": 0.88
        },
        "gate": {
          "durationMs": 650,
          "intensity": 0.73
        },
        "switch": {
          "durationMs": 340,
          "intensity": 0.42
        }
      }
    },
    "imageCache": {
      "limit": 16,
      "parallel": 3
    },
    "flashlight": {
      "modifiers": {
        "gotica": {
          "approach": -0.58,
          "entry": -0.65,
          "stayShareDelta": -0.4
        },
        "yandere": {
          "approach": -0.58,
          "entry": -0.65,
          "stayShareDelta": -0.4
        },
        "gatinha": {
          "approach": 0.18,
          "entry": 0.12,
          "stayShareDelta": 0
        }
      },
      "buildPerSecond": 0.25,
      "decayPerSecond": 0.2,
      "minimumAdvance": 0.05,
      "maximumAdvance": 0.995
    },
    "noise": {
      "rates": {
        "radio": 6,
        "computer": 0.75,
        "viewMoving": 0.25
      },
      "events": {
        "closetEnter": 5,
        "closetExit": 5
      },
      "decay": 3,
      "max": 40
    }
  },
  "map": {
    "positions": [
      {
        "id": 1,
        "name": "Palco",
        "cameras": [
          "CAM03"
        ],
        "room": "salao",
        "point": [
          19.7,
          20.3
        ]
      },
      {
        "id": 2,
        "name": "Meio do salão",
        "cameras": [
          "CAM03"
        ],
        "room": "salao",
        "point": [
          19,
          14.8
        ]
      },
      {
        "id": 3,
        "name": "Fundo do salão (CAM 04)",
        "cameras": [
          "CAM04"
        ],
        "room": "salao",
        "point": [
          24.2,
          8.2
        ]
      },
      {
        "id": 4,
        "name": "Fliperama",
        "cameras": [
          "CAM07"
        ],
        "room": "fliperama",
        "point": [
          30.3,
          6
        ]
      },
      {
        "id": 5,
        "name": "Recepção",
        "cameras": [
          "CAM02"
        ],
        "room": "recepcao",
        "point": [
          15.8,
          2.6
        ]
      },
      {
        "id": 6,
        "name": "VIP 1",
        "cameras": [
          "CAM05"
        ],
        "room": "vip1",
        "point": [
          10.6,
          18.5
        ]
      },
      {
        "id": 7,
        "name": "VIP 2",
        "cameras": [
          "CAM06"
        ],
        "room": "vip2",
        "point": [
          10.2,
          11.2
        ]
      },
      {
        "id": 8,
        "name": "Saída da recepção",
        "cameras": [
          "CAM02"
        ],
        "room": "recepcao",
        "point": [
          19,
          0.65
        ]
      },
      {
        "id": 9,
        "name": "Lojinha",
        "cameras": [
          "CAM01"
        ],
        "room": "loja",
        "point": [
          6,
          2.5
        ]
      },
      {
        "id": 10,
        "name": "Estoque",
        "cameras": [
          "CAM08"
        ],
        "room": "estoque",
        "point": [
          2.45,
          12.9
        ]
      },
      {
        "id": 11,
        "name": "Saída do estoque",
        "cameras": [
          "CAM08"
        ],
        "room": "estoque",
        "point": [
          0.65,
          11.5
        ]
      },
      {
        "id": 12,
        "name": "Porta esquerda da sala de controle",
        "cameras": [],
        "room": "estoque",
        "point": [
          3.1,
          8.05
        ]
      },
      {
        "id": 13,
        "name": "Sala de controle (ataque)",
        "cameras": [],
        "room": "controle",
        "point": [
          6.05,
          7.9
        ]
      },
      {
        "id": 14,
        "name": "Corredor central — frente",
        "cameras": [],
        "room": "corredor_servico",
        "point": [
          5.75,
          11.1
        ]
      },
      {
        "id": 15,
        "name": "Corredor central — fundo",
        "cameras": [],
        "room": "corredor_servico",
        "point": [
          5.65,
          19.1
        ]
      },
      {
        "id": 16,
        "name": "Serviço (Parts & Service)",
        "cameras": [
          "CAM09"
        ],
        "room": "servico",
        "point": [
          2.15,
          19
        ]
      },
      {
        "id": 17,
        "name": "Cozinha",
        "cameras": [
          "CAM10"
        ],
        "room": "cozinha",
        "point": [
          6.8,
          26.2
        ]
      },
      {
        "id": 18,
        "name": "Retirada de comida",
        "cameras": [
          "CAM11"
        ],
        "room": "retirada",
        "point": [
          16.6,
          26.65
        ]
      },
      {
        "id": 19,
        "name": "Corredor da CAM 12",
        "cameras": [
          "CAM12"
        ],
        "room": "corredor_servico",
        "point": [
          23.8,
          23.3
        ]
      },
      {
        "id": 20,
        "name": "Sala da Nath",
        "cameras": [],
        "room": "nathzinha",
        "point": [
          21.5,
          26.2
        ]
      },
      {
        "id": 21,
        "name": "Elétrica",
        "cameras": [],
        "room": "eletrica",
        "point": [
          27.5,
          26.2
        ]
      },
      {
        "id": 22,
        "name": "Saída do corredor",
        "cameras": [],
        "room": "corredor_servico",
        "point": [
          31.5,
          27.3
        ]
      },
      {
        "id": 23,
        "name": "Ponto cego do salão principal",
        "cameras": [],
        "room": "salao",
        "point": [
          25.9,
          19
        ]
      },
      {
        "id": 24,
        "name": "Banheiro — esconderijo da Gatinha",
        "cameras": [],
        "room": "wc_m",
        "point": [
          29.1,
          16.7
        ]
      },
      {
        "id": 25,
        "name": "Escondida na VIP 2",
        "cameras": [],
        "room": "vip2",
        "point": [
          10.2,
          15.1
        ]
      }
    ],
    "edges": [
      {
        "from": 1,
        "to": 2,
        "type": "room"
      },
      {
        "from": 2,
        "to": 3,
        "type": "room"
      },
      {
        "from": 2,
        "to": 6,
        "type": "gate",
        "gateId": "G05"
      },
      {
        "from": 2,
        "to": 7,
        "type": "gate",
        "gateId": "G03"
      },
      {
        "from": 1,
        "to": 19,
        "type": "gate",
        "gateId": "G06"
      },
      {
        "from": 3,
        "to": 5,
        "type": "gate",
        "gateId": "G08"
      },
      {
        "from": 3,
        "to": 7,
        "type": "gate",
        "gateId": "G03"
      },
      {
        "from": 3,
        "to": 23,
        "type": "room"
      },
      {
        "from": 5,
        "to": 8,
        "type": "room"
      },
      {
        "from": 5,
        "to": 9,
        "type": "free",
        "openingId": "P01"
      },
      {
        "from": 6,
        "to": 15,
        "type": "gate",
        "gateId": "G04"
      },
      {
        "from": 7,
        "to": 15,
        "type": "gate",
        "gateId": "G02"
      },
      {
        "from": 7,
        "to": 25,
        "type": "room"
      },
      {
        "from": 8,
        "to": 11,
        "type": "exterior",
        "exits": [
          "EXT01",
          "EXT02"
        ],
        "actors": [
          "padrao"
        ]
      },
      {
        "from": 8,
        "to": 22,
        "type": "exterior",
        "exits": [
          "EXT01",
          "EXT03"
        ],
        "actors": [
          "padrao"
        ]
      },
      {
        "from": 9,
        "to": 10,
        "type": "gate",
        "gateId": "G09"
      },
      {
        "from": 10,
        "to": 11,
        "type": "room"
      },
      {
        "from": 10,
        "to": 12,
        "type": "room"
      },
      {
        "from": 10,
        "to": 15,
        "type": "free",
        "openingId": "P03"
      },
      {
        "from": 11,
        "to": 22,
        "type": "exterior",
        "exits": [
          "EXT02",
          "EXT03"
        ],
        "actors": [
          "padrao"
        ]
      },
      {
        "from": 12,
        "to": 13,
        "type": "free",
        "openingId": "P02"
      },
      {
        "from": 14,
        "to": 13,
        "type": "gate",
        "gateId": "G01",
        "oneWay": true
      },
      {
        "from": 14,
        "to": 15,
        "type": "room"
      },
      {
        "from": 15,
        "to": 16,
        "type": "free",
        "openingId": "P04"
      },
      {
        "from": 15,
        "to": 17,
        "type": "free",
        "openingId": "P07"
      },
      {
        "from": 15,
        "to": 18,
        "type": "free",
        "openingId": "P10"
      },
      {
        "from": 16,
        "to": 17,
        "type": "free",
        "openingId": "P06"
      },
      {
        "from": 17,
        "to": 18,
        "type": "free",
        "openingId": "P09"
      },
      {
        "from": 19,
        "to": 18,
        "type": "free",
        "openingId": "P10"
      },
      {
        "from": 19,
        "to": 20,
        "type": "free",
        "openingId": "P11",
        "actors": [
          "padrao"
        ]
      },
      {
        "from": 19,
        "to": 21,
        "type": "free",
        "openingId": "P12",
        "actors": [
          "yandere"
        ]
      },
      {
        "from": 19,
        "to": 22,
        "type": "room"
      },
      {
        "from": 3,
        "to": 4,
        "type": "gate",
        "gateId": "G07",
        "via": [
          "P14"
        ],
        "through": [
          "circ_wc"
        ]
      },
      {
        "from": 3,
        "to": 24,
        "type": "gate",
        "gateId": "G07",
        "via": [
          "P15"
        ],
        "through": [
          "circ_wc"
        ],
        "actors": [
          "gatinha"
        ]
      },
      {
        "from": 4,
        "to": 24,
        "type": "free",
        "openingId": "P14",
        "via": [
          "P15"
        ],
        "through": [
          "circ_wc"
        ],
        "actors": [
          "gatinha"
        ]
      }
    ],
    "stage": 1,
    "office": 13,
    "left": 12,
    "front": 14,
    "back": 15,
    "leftApproach": 10,
    "capacities": {
      "12": 1,
      "14": 2,
      "15": 3
    },
    "maxClosedMapGates": 3
  },
  "movement": {
    "jitter": {
      "min": -1.5,
      "max": 1.5
    },
    "weight": 1,
    "stayFactor": 0.25,
    "backtrackFactor": 0.5,
    "retryWindow": 5,
    "failedIntervalFactor": 0.35,
    "failedModifierRetention": 0.75,
    "routes": {
      "bonusByLevel": [
        {
          "minLevel": 1,
          "bonus": 18
        },
        {
          "minLevel": 4,
          "bonus": 24
        },
        {
          "minLevel": 8,
          "bonus": 30
        }
      ],
      "bonusPerMove": 1,
      "definitions": {
        "CV": {
          "objective": "corridor",
          "target": 15,
          "paths": [
            [
              6,
              15
            ],
            [
              7,
              15
            ]
          ]
        },
        "CC": {
          "objective": "corridor",
          "target": 15,
          "paths": [
            [
              19,
              18,
              15
            ],
            [
              19,
              18,
              17,
              15
            ]
          ]
        },
        "EL": {
          "objective": "stock",
          "target": 10,
          "paths": [
            [
              5,
              9,
              10
            ]
          ]
        },
        "EC": {
          "objective": "stock",
          "target": 10,
          "paths": [
            [
              19,
              18,
              15,
              10
            ],
            [
              19,
              18,
              17,
              15,
              10
            ]
          ]
        },
        "EV": {
          "objective": "stock",
          "target": 10,
          "paths": [
            [
              6,
              15,
              10
            ],
            [
              7,
              15,
              10
            ]
          ]
        },
        "ES": {
          "objective": "stock",
          "target": 10,
          "paths": [
            [
              8,
              11,
              10
            ],
            [
              22,
              11,
              10
            ]
          ]
        },
        "EE": {
          "objective": "electrical",
          "target": 21
        }
      }
    },
    "attack": {
      "corridor": {
        "approach": {
          "base": 0.76,
          "maxNoiseBonus": 0.2
        },
        "entry": {
          "base": 0.86,
          "maxNoiseBonus": 0.12
        }
      },
      "stock": {
        "approach": {
          "base": 0.76,
          "maxNoiseBonus": 0.2
        },
        "entry": {
          "base": 0.86,
          "maxNoiseBonus": 0.12
        }
      },
      "stayShare": 0.6
    },
    "retreat": {
      "stock": [
        9,
        6,
        11
      ],
      "corridor": [
        17,
        6,
        7
      ],
      "office": [
        6,
        7,
        9,
        11
      ]
    },
    "recovery": {
      "intervalFactor": 1.25,
      "freeMoves": 1
    },
    "difficulty": {
      "oddSteps": [
        1,
        3,
        5,
        7,
        9,
        10
      ],
      "intervalReductionPerStep": 8,
      "maidTargetBonusLevels": [
        2,
        8
      ],
      "maidTargetBonusIncreasePerStep": 40,
      "abilityLevel": 4,
      "reactionLevel": 6,
      "reactionReduction": 11
    }
  },
  "night": {
    "rulesVersion": "1.1.2",
    "clock": {
      "fastSanity": 90,
      "slowSanity": 10,
      "fastSecondsPerHour": 60,
      "slowSecondsPerHour": 240
    },
    "startHour": 12,
    "hoursToWin": 6,
    "powerEnabled": true,
    "sanityEnabled": true,
    "defaultLevel": 0,
    "levels": [
      0,
      10
    ],
    "campaign": [
      {
        "movementDelay": 40,
        "maxClosedGates": 0,
        "secondsPerHour": 50,
        "hoursToWin": 6,
        "powerEnabled": false,
        "sanityEnabled": false,
        "levels": {
          "gotica": 5,
          "yandere": 3,
          "palhaca": 0,
          "padrao": 0,
          "gatinha": 0,
          "maid": 0,
          "smores": 0,
          "shadow": 0
        }
      },
      {
        "movementDelay": 40,
        "maxClosedGates": 1,
        "secondsPerHour": 55,
        "hoursToWin": 6,
        "powerEnabled": false,
        "sanityEnabled": false,
        "levels": {
          "gotica": 5,
          "yandere": 7,
          "palhaca": 2,
          "padrao": 0,
          "gatinha": 0,
          "maid": 0,
          "smores": 0,
          "shadow": 0
        }
      },
      {
        "movementDelay": 30,
        "maxClosedGates": 2,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": false,
        "levels": {
          "gotica": 3,
          "yandere": 5,
          "palhaca": 1,
          "padrao": 1,
          "gatinha": 0,
          "maid": 0,
          "smores": 0,
          "shadow": 0
        }
      },
      {
        "movementDelay": 25,
        "maxClosedGates": 3,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 3,
          "yandere": 4,
          "palhaca": 2,
          "padrao": 2,
          "gatinha": 1,
          "maid": 0,
          "smores": 0,
          "shadow": 0
        }
      },
      {
        "movementDelay": 20,
        "maxClosedGates": 4,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 3,
          "yandere": 4,
          "palhaca": 5,
          "padrao": 3,
          "gatinha": 2,
          "maid": 9,
          "smores": 0,
          "shadow": 0
        }
      },
      {
        "movementDelay": 20,
        "maxClosedGates": 5,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 4,
          "yandere": 5,
          "palhaca": 8,
          "padrao": 4,
          "gatinha": 10,
          "maid": 2,
          "smores": 3,
          "shadow": 0
        }
      },
      {
        "movementDelay": 15,
        "maxClosedGates": 6,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 5,
          "yandere": 5,
          "palhaca": 4,
          "padrao": 8,
          "gatinha": 7,
          "maid": 5,
          "smores": 2,
          "shadow": 1
        }
      },
      {
        "movementDelay": 12,
        "maxClosedGates": 7,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 7,
          "yandere": 7,
          "palhaca": 5,
          "padrao": 9,
          "gatinha": 7,
          "maid": 7,
          "smores": 5,
          "shadow": 3
        }
      },
      {
        "movementDelay": 12,
        "maxClosedGates": 8,
        "secondsPerHour": 60,
        "hoursToWin": 7,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 7,
          "yandere": 7,
          "palhaca": 5,
          "padrao": 10,
          "gatinha": 7,
          "maid": 7,
          "smores": 6,
          "shadow": 10
        }
      }
    ]
  },
  "power": {
    "initial": 100,
    "computerDrain": 0.018,
    "gateDrain": 0.028,
    "radioGraceSeconds": 25,
    "warningBelow": 15
  },
  "sanity": {
    "initial": 100,
    "loss": {
      "camera": 0.15,
      "direct": 0.35,
      "centralGate": 0.1,
      "closet": 0.5,
      "invasion": 2
    },
    "recovery": {
      "music": 0.2,
      "passive": 0.05
    },
    "blackoutLossMultiplier": 2
  },
  "shadow": {
    "name": "Nathzinha Shadow",
    "firstLevel": {
      "sanityLimit": 40,
      "chance": 10,
      "searchSeconds": 10
    },
    "lastLevel": {
      "sanityLimit": 60,
      "chance": 15,
      "searchSeconds": 7.5
    },
    "chancePerSanityPoint": 1,
    "manifestSeconds": 1.15,
    "foundSeconds": 0.65,
    "jumpscareMs": 1200,
    "officeArt": "./public/images/shadow/office.webp",
    "sprite": "./public/images/shadow/camera-sprite.webp",
    "jumpscare": "./public/images/jumpscares/shadow.webp"
  },
  "threats": {
    "smores": {
      "name": "Smores",
      "radioSeconds": 15,
      "silenceSeconds": 10,
      "quietRoomSpeed": 2,
      "targetBonusMultiplier": 2,
      "level1": {
        "ventChance": 15,
        "roomSeconds": 35,
        "intervalReduction": 1,
        "reactionReduction": 0.3
      },
      "level10": {
        "ventChance": 20,
        "roomSeconds": 50,
        "intervalReduction": 1.5,
        "reactionReduction": 0.4
      }
    },
    "attack": {
      "stay": 5.5,
      "lateStay": 8.5,
      "lateThreshold": 0.8,
      "jitter": {
        "min": -2.5,
        "max": 2.5
      }
    },
    "clown": {
      "name": "Palhaça",
      "initial": 1,
      "min": 1,
      "max": 100,
      "stages": [
        1,
        20,
        50,
        80
      ],
      "entryDeathAbove": 80,
      "floorPerEntry": 10,
      "growth": 0.8,
      "closetGrowthFactor": 3,
      "musicReduction": 2,
      "growthIncreasePerLevel": 10
    }
  }
};
