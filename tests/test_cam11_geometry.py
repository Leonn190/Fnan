"""Regressão geométrica da CAM11; é executada sem build do site."""
import importlib.util
import json
from pathlib import Path
import unittest
from shapely.geometry import Point

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("fnan_planta", ROOT / "outros/planta/nathzinha_v7_planta_tecnica.py")
planta = importlib.util.module_from_spec(spec)
spec.loader.exec_module(planta)

class TestCam11(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "outros/planta/nathzinha_v7_planta_medidas.json").read_text(encoding="utf-8"))
        cls.cam = next(c for c in cls.data["cameras"] if c["id"] == "CAM11")
        cls.rooms, footprint, _, walls = planta.geometries(cls.data)
        cls.fov = planta.field_polygon(cls.cam, walls, footprint)

    def test_cam11_inside_retirada(self):
        self.assertEqual(len(self.data["cameras"]), 12)
        self.assertEqual(self.cam["sala"], "retirada")
        self.assertEqual(self.cam["posicao_lente_m"], [17.75, 27.75])
        self.assertEqual(self.cam["altura_lente_m"], 2.8)
        self.assertEqual((self.cam["azimute_graus"], self.cam["abertura_horizontal_graus"]), (223, 90))
        self.assertTrue(self.rooms["retirada"].contains(Point(*self.cam["posicao_lente_m"])))

    def test_other_camera_and_architecture(self):
        c12 = next(c for c in self.data["cameras"] if c["id"] == "CAM12")
        self.assertEqual((c12["sala"], c12["posicao_lente_m"], c12["azimute_graus"], c12["abertura_horizontal_graus"]), ("corredor_servico", [32.22, 23.25], 180, 82))
        openings = {o["id"]:o for o in self.data["aberturas"]}
        p10, p09 = openings["P10"], openings["P09"]
        self.assertEqual((p10["eixo"], p10["coordenada_fixa_m"], p10["inicio_m"], p10["fim_m"]), ("H", 24.4, 12.9, 17.1))
        self.assertEqual((p09["eixo"], p09["coordenada_fixa_m"], p09["inicio_m"], p09["fim_m"]), ("V", 10.8, 25.3, 26.5))
        counter = next(o for o in self.data["elementos_fixos"] if o["id"] == "BALCAO_RETIRADA")
        self.assertEqual(counter["retangulo_m"], [14.2, 24.85, 16.9, 25.6])

    def test_fov_sees_retirada_corridor_and_kitchen(self):
        visible_room = self.fov.intersection(self.rooms["retirada"]).area
        visible_corridor = self.fov.intersection(self.rooms["corredor_servico"]).area
        visible_kitchen = self.fov.intersection(self.rooms["cozinha"]).area
        self.assertGreater(visible_room, 20, "A retirada deve ocupar a maior parte possível do enquadramento")
        self.assertGreater(visible_corridor, 1, "P10 deve permitir visão parcial do corredor")
        self.assertGreater(visible_kitchen, 0.01, "P09 deve permitir visão parcial da cozinha")
        self.assertGreater(visible_room, visible_corridor)
        self.assertGreater(visible_room, visible_kitchen)

    def test_browser_export_consistent(self):
        source = (ROOT / "src/data/game-data.js").read_text(encoding="utf-8")
        cam11 = source[source.index('"id": "CAM11"'):source.index('"id": "CAM12"')]
        for field in ('"room": "retirada"', '"x": 17.75', '"y": 27.75', '"angle": 223', '"fov": 90', '"image": null', '"renderAvailable": false', '"angleConvention": "cartesian"'):
            self.assertIn(field, cam11)

if __name__ == "__main__":
    unittest.main()
