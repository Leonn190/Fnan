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
      "trackable": true,
      "interval": 24,
      "reaction": 3.5,
      "target": 10,
      "targetBonus": 10,
      "audioModifier": -30,
      "doorChance": [
        70,
        94
      ],
      "extraRetreat": [
        11
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
        19,
        20
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
      "trackable": true,
      "interval": 26,
      "reaction": 4.5,
      "target": 10,
      "targetBonus": 10,
      "audioModifier": 50,
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
        20,
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
      "trackable": true,
      "interval": 21,
      "reaction": 4.5,
      "target": 21,
      "targetBonus": 20,
      "audioModifier": 50
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
      "trackable": true,
      "interval": 19,
      "reaction": 4.5,
      "target": 10,
      "targetBonus": 10,
      "audioModifier": 20,
      "hidingPlaces": [
        23,
        24,
        25
      ],
      "hidingBonus": 5,
      "corridorAdvancePenalty": -40,
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
      "trackable": false,
      "interval": 29,
      "reaction": 2.5,
      "target": 13,
      "targetBonus": 10,
      "audioModifier": 20,
      "initialStationaryAttempts": 1,
      "initialIntervalReduction": 10
    }
  },
  "controls": {
    "restarts": {
      "system": 5,
      "allSystems": 9,
      "locator": 4,
      "allLocators": 7
    },
    "closetTransitionsMs": {
      "enter": {
        "swap": 980,
        "duration": 1450
      },
      "turn": {
        "swap": 320,
        "duration": 640
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
      "duration": 7,
      "cooldown": 12,
      "factors": [
        1,
        1,
        0.15
      ],
      "excluded": [
        8,
        11,
        22,
        23,
        24,
        25
      ]
    },
    "static": {
      "duration": 2,
      "gateClosingChance": 100
    },
    "flashlight": {
      "rates": {
        "gotica": {
          "advance": -4,
          "retreat": 4
        },
        "yandere": {
          "advance": -4,
          "retreat": 4
        },
        "gatinha": {
          "advance": 6,
          "retreat": 0
        }
      },
      "min": -90,
      "max": 90,
      "recovery": 1.5
    },
    "noise": {
      "rates": {
        "radio": 3,
        "computer": 1.5,
        "viewMoving": 0.2
      },
      "events": {
        "closetRoundTrip": 15
      },
      "decay": 2,
      "max": null
    }
  },
  "map": {
    "positions": [
      {
        "id": 1,
        "name": "Palco",
        "cameras": [
          "CAM03"
        ]
      },
      {
        "id": 2,
        "name": "Meio do salão",
        "cameras": [
          "CAM03"
        ]
      },
      {
        "id": 3,
        "name": "Fundo do salão (CAM 04)",
        "cameras": [
          "CAM04"
        ]
      },
      {
        "id": 4,
        "name": "Fliperama",
        "cameras": [
          "CAM07"
        ]
      },
      {
        "id": 5,
        "name": "Recepção",
        "cameras": [
          "CAM02"
        ]
      },
      {
        "id": 6,
        "name": "VIP 1",
        "cameras": [
          "CAM05"
        ]
      },
      {
        "id": 7,
        "name": "VIP 2",
        "cameras": [
          "CAM06"
        ]
      },
      {
        "id": 8,
        "name": "Saída da recepção",
        "cameras": [
          "CAM02"
        ]
      },
      {
        "id": 9,
        "name": "Lojinha",
        "cameras": [
          "CAM01"
        ]
      },
      {
        "id": 10,
        "name": "Estoque",
        "cameras": [
          "CAM08"
        ]
      },
      {
        "id": 11,
        "name": "Saída do estoque",
        "cameras": [
          "CAM08"
        ]
      },
      {
        "id": 12,
        "name": "Porta esquerda da sala de controle",
        "cameras": []
      },
      {
        "id": 13,
        "name": "Sala de controle (ataque)",
        "cameras": []
      },
      {
        "id": 14,
        "name": "Corredor central — frente",
        "cameras": []
      },
      {
        "id": 15,
        "name": "Corredor central — fundo",
        "cameras": []
      },
      {
        "id": 16,
        "name": "Serviço (Parts & Service)",
        "cameras": [
          "CAM09"
        ]
      },
      {
        "id": 17,
        "name": "Cozinha",
        "cameras": [
          "CAM10"
        ]
      },
      {
        "id": 18,
        "name": "Retirada de comida",
        "cameras": [
          "CAM11"
        ]
      },
      {
        "id": 19,
        "name": "Corredor da CAM 12",
        "cameras": [
          "CAM12"
        ]
      },
      {
        "id": 20,
        "name": "Sala da Nath",
        "cameras": []
      },
      {
        "id": 21,
        "name": "Elétrica",
        "cameras": []
      },
      {
        "id": 22,
        "name": "Saída do corredor",
        "cameras": []
      },
      {
        "id": 23,
        "name": "Ponto cego do salão principal",
        "cameras": []
      },
      {
        "id": 24,
        "name": "Banheiro — esconderijo da Gatinha",
        "cameras": []
      },
      {
        "id": 25,
        "name": "Escondida na VIP 2",
        "cameras": []
      }
    ],
    "edges": [
      [
        1,
        2
      ],
      [
        2,
        3
      ],
      [
        2,
        6
      ],
      [
        2,
        7
      ],
      [
        2,
        19
      ],
      [
        3,
        4
      ],
      [
        3,
        5
      ],
      [
        3,
        7
      ],
      [
        3,
        23
      ],
      [
        3,
        24
      ],
      [
        4,
        24
      ],
      [
        5,
        8
      ],
      [
        5,
        9
      ],
      [
        6,
        15
      ],
      [
        7,
        14
      ],
      [
        7,
        25
      ],
      [
        8,
        11
      ],
      [
        8,
        22
      ],
      [
        9,
        10
      ],
      [
        10,
        11
      ],
      [
        10,
        12
      ],
      [
        10,
        14
      ],
      [
        11,
        22
      ],
      [
        12,
        13
      ],
      [
        13,
        14
      ],
      [
        14,
        15
      ],
      [
        14,
        25
      ],
      [
        15,
        16
      ],
      [
        15,
        17
      ],
      [
        15,
        18
      ],
      [
        15,
        19
      ],
      [
        16,
        17
      ],
      [
        17,
        18
      ],
      [
        19,
        20
      ],
      [
        19,
        21
      ],
      [
        19,
        22
      ]
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
    "gateEdges": {
      "G02": [
        [
          7,
          14
        ],
        [
          25,
          14
        ]
      ],
      "G06": [
        [
          2,
          19
        ]
      ],
      "G01": [
        [
          14,
          13
        ]
      ]
    },
    "otherGateEdges": null,
    "maxClosedMapGates": 3
  },
  "movement": {
    "jitter": {
      "min": -1.5,
      "max": 1.5
    },
    "weight": 1,
    "backtrackFactor": 0.5,
    "retryWindow": 3,
    "failedIntervalFactor": 0.5,
    "failedModifierRetention": 0.75,
    "leftAttackChance": 75,
    "leftApproachFactor": 0.45,
    "retreat": {
      "destinations": [
        9,
        6,
        7
      ],
      "previous": {
        "6": 15,
        "7": 14,
        "9": 10,
        "11": 10
      },
      "intervalFactor": 1.5
    },
    "difficulty": {
      "oddSteps": [
        1,
        3,
        5,
        7,
        9
      ],
      "intervalReductionPerStep": 8,
      "targetBonusLevels": [
        2,
        8
      ],
      "targetBonusIncreasePerStep": 40,
      "abilityLevel": 4,
      "reactionLevel": 6,
      "reactionReduction": 11
    }
  },
  "night": {
    "rulesVersion": "1.1.2",
    "secondsPerHour": 60,
    "startHour": 12,
    "hoursToWin": 6,
    "normalLevel": 0,
    "levels": [
      0,
      9
    ],
    "sanity": null
  },
  "threats": {
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
    },
    "sabotage": {
      "position": 21,
      "systems": {
        "cameras": 1,
        "portas": 1,
        "audio": 1,
        "ventilacao": 1
      },
      "countWeights": [
        {
          "1": 75,
          "2": 25
        },
        {
          "1": 51,
          "2": 39,
          "3": 10
        }
      ],
      "duration": null,
      "effects": {
        "cameras": null,
        "portas": null,
        "audio": null,
        "ventilacao": {
          "deadline": 25,
          "repair": null,
          "autoEnd": null
        }
      }
    }
  }
};
